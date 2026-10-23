import { prisma } from "../db";
import { audit } from "../audit";
import { now } from "../clock";
import { badRequest, conflict, forbidden } from "../errors";
import { type Actor, requireAnyManager, requireManagerOf } from "../actor";
import { DECISION_LABELS, MANAGER_DECISIONS, POLICY, type ManagerDecision } from "./constants";
import { recomputeIncident } from "./incidents";
import { transition } from "./stateMachine";

const DAY = 24 * 3600_000;

// Management review (docs/02). Only community-scoped managers get here, and
// only a human decision can produce an advisory or a formal warning (T19).

export async function listQueue(actor: Actor) {
  requireAnyManager(actor);
  const flags = await prisma.reviewFlag.findMany({
    where: { status: "OPEN", case: { communityId: { in: actor.managerCommunityIds } } },
    include: { case: true },
    orderBy: { createdAt: "asc" },
  });
  const labels = await householdLabels(flags.map((f) => f.targetHouseholdId));
  const letters = new Set(
    (await prisma.warningLetter.findMany({ where: { flagId: { in: flags.map((f) => f.id) }, status: "DRAFT" }, select: { flagId: true } })).map((l) => l.flagId),
  );
  return flags.map((f) => ({
    letterReady: letters.has(f.id),
    id: f.id,
    reason: f.reason,
    detail: f.detail,
    category: f.category,
    createdAt: f.createdAt,
    targetLabel: labels[f.targetHouseholdId] ?? "Unknown",
    caseState: f.case.state,
  }));
}

async function householdLabels(ids: string[]) {
  const rows = await prisma.household.findMany({ where: { id: { in: ids } }, select: { id: true, label: true } });
  return Object.fromEntries(rows.map((r) => [r.id, r.label]));
}

async function loadFlagForManager(actor: Actor, flagId: string) {
  const flag = await prisma.reviewFlag.findUnique({ where: { id: flagId }, include: { case: true } });
  if (!flag) throw forbidden();
  requireManagerOf(actor, flag.case.communityId);
  return flag;
}

// Case context for the reviewer. Reporter identity and the raw report are NOT
// included here; they need an explicit, reasoned reveal (see revealRestricted).
export async function getReviewDetail(actor: Actor, flagId: string) {
  const flag = await loadFlagForManager(actor, flagId);
  const c = flag.case;
  const at = await now();
  await audit(actor.userId, "ReviewCaseViewed", "case", c.id, at, { flagId });

  const [messages, relays, notice, actions, target] = await Promise.all([
    prisma.message.findMany({ where: { caseId: c.id }, orderBy: { createdAt: "asc" } }),
    prisma.relay.findMany({ where: { caseId: c.id }, orderBy: { createdAt: "asc" } }),
    prisma.noticeDraft.findFirst({ where: { caseId: c.id, sentAt: { not: null } } }),
    prisma.managementAction.findMany({ where: { caseId: c.id }, orderBy: { createdAt: "asc" } }),
    prisma.household.findUniqueOrThrow({ where: { id: c.targetHouseholdId } }),
  ]);

  // Separate incidents for the same household + category in the last 30 days,
  // with how many reports each one grouped (duplicates count once).
  const incidents = await prisma.incident.findMany({
    where: {
      targetHouseholdId: c.targetHouseholdId,
      category: c.category,
      occurredAt: { gte: new Date(at.getTime() - POLICY.repeatWindowDays * DAY) },
    },
    include: { _count: { select: { cases: true } } },
    orderBy: { occurredAt: "asc" },
  });

  return {
    flag: { id: flag.id, reason: flag.reason, detail: flag.detail, status: flag.status, createdAt: flag.createdAt },
    case: {
      id: c.id,
      category: c.category,
      state: c.state,
      disputed: c.disputed,
      occurredAt: c.occurredAt,
      noticeSentAt: c.noticeSentAt,
      targetLabel: target.label,
    },
    approvedNotice: notice?.text ?? null,
    messages: messages.map((m) => ({ side: m.side, author: m.author, kind: m.kind, body: m.body, createdAt: m.createdAt })),
    relays: relays.map((r) => ({ responseType: r.responseType, rawText: r.rawText, relayText: r.relayText, status: r.status, createdAt: r.createdAt })),
    incidents: incidents.map((i) => ({ id: i.id, occurredAt: i.occurredAt, status: i.status, reports: i._count.cases, isThisCase: i.id === c.incidentId })),
    actions: actions.map((a) => ({ decision: a.decision, rationale: a.rationale, policyRef: a.policyRef, createdAt: a.createdAt })),
  };
}

export async function revealRestricted(actor: Actor, flagId: string, reason: string) {
  const flag = await loadFlagForManager(actor, flagId);
  if (reason.trim().length < 10) throw badRequest("Give a reason (at least 10 characters). Access is logged.");
  const c = flag.case;
  const [user, hh] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: c.reporterUserId } }),
    prisma.household.findUniqueOrThrow({ where: { id: c.reporterHouseholdId } }),
  ]);
  await audit(actor.userId, "SensitiveIdentityAccessed", "case", c.id, await now(), { flagId, reason: reason.trim().slice(0, 300) });
  return { reporterName: user.displayName, reporterHousehold: hh.label, rawReport: c.rawText };
}

export async function decide(
  actor: Actor,
  flagId: string,
  input: { decision: string; rationale: string; policyRef: string; letterText?: string },
) {
  const flag = await loadFlagForManager(actor, flagId);
  if (flag.status !== "OPEN") throw conflict("This flag has already been decided.");
  if (!MANAGER_DECISIONS.includes(input.decision as ManagerDecision)) throw badRequest("Choose a decision.");
  const rationale = input.rationale.trim();
  const policyRef = input.policyRef.trim();
  if (rationale.length < 10) throw badRequest("Please record a rationale (at least 10 characters).");
  if (policyRef.length < 3) throw badRequest("Please reference the policy or rule applied.");

  const decision = input.decision as ManagerDecision;
  const c = flag.case;
  const at = await now();

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.reviewFlag.updateMany({ where: { id: flag.id, status: "OPEN" }, data: { status: "DECIDED", reviewedAt: at } });
    if (claimed.count !== 1) throw conflict("This flag has already been decided.");
    await tx.managementAction.create({ data: { caseId: c.id, flagId: flag.id, reviewerId: actor.userId, decision, rationale, policyRef, createdAt: at } });

    const msg = (side: string, body: string) => tx.message.create({ data: { caseId: c.id, side, author: "SYSTEM", kind: "MANAGEMENT", body, createdAt: at } });

    if (decision === "REQUEST_CONTEXT") {
      if (c.state === "HUMAN_REVIEW" || c.state === "MODERATION_HOLD") await transition(tx, c.id, c.state, "ASSISTED_RESOLUTION");
      const ask = "Community management is reviewing this case and would welcome any further context. You can reply through this channel.";
      await msg("REPORTER", ask);
      if (c.noticeSentAt) await msg("RECIPIENT", ask);
      return;
    }

    if (c.state !== "CLOSED") await transition(tx, c.id, c.state, "CLOSED", { closedAt: at });
    if (decision === "MANAGEMENT_ADVISORY" || decision === "FORMAL_WARNING") {
      const kind = decision === "FORMAL_WARNING" ? "a formal warning" : "an advisory";
      // A warning letter (drafted automatically, reviewed and sent by this manager) replaces the short message.
      const letter = decision === "FORMAL_WARNING" ? input.letterText?.trim() : undefined;
      await msg("RECIPIENT", letter || `Community management has reviewed this case and issued ${kind} under ${policyRef}. Reason: ${rationale}`);
      await msg("REPORTER", "Community management has reviewed this case and taken action under community rules. The case is now closed.");
    } else {
      const outcome = decision === "CLOSE_RESOLVED" ? "closed it as resolved" : "closed it with no finding against anyone";
      await msg("REPORTER", `Community management has reviewed this case and ${outcome}.`);
      if (c.noticeSentAt) await msg("RECIPIENT", `Community management has reviewed this case and ${outcome}.`);
    }

    // A reviewer can overturn an inappropriate flag: dismissed incidents stop counting.
    if (c.incidentId && decision === "CLOSE_UNSUBSTANTIATED") {
      await tx.incident.update({ where: { id: c.incidentId }, data: { status: "DISMISSED" } });
    }
  });

  if (c.incidentId && decision === "CLOSE_RESOLVED") await recomputeIncident(c.incidentId);
  // A drafted warning letter is only sent via sendWarningLetter; any other final decision discards it.
  if (decision !== "REQUEST_CONTEXT" && !input.letterText) {
    await prisma.warningLetter.updateMany({ where: { flagId: flag.id, status: "DRAFT" }, data: { status: "DISCARDED" } });
  }
  // Close sibling flags on the same case so the queue doesn't show stale items.
  if (decision !== "REQUEST_CONTEXT") {
    await prisma.reviewFlag.updateMany({ where: { caseId: c.id, status: "OPEN" }, data: { status: "DECIDED", reviewedAt: at } });
  }
  await audit(actor.userId, decision === "FORMAL_WARNING" ? "ManagementWarningIssued" : "ManagerReviewed", "case", c.id, at, {
    flagId: flag.id,
    decision,
    label: DECISION_LABELS[decision],
    policyRef,
  });
}
