import { prisma } from "../db";
import { audit } from "../audit";
import { now } from "../clock";
import { AppError, badRequest, conflict, forbidden } from "../errors";
import { type Actor, requireResident } from "../actor";
import { runMediator } from "../mediator";
import { analyseReport } from "../mediator/local";
import { NoticeOutputSchema, RelayOutputSchema, TONES, type Tone } from "../mediator/types";
import { CATEGORIES, POLICY, RESPONSE_TYPES, TOPIC_MAX, TOPIC_MIN, type Category, type ResponseType } from "./constants";
import { AI_UNAVAILABLE, NOTICE_DELIVERED, SAFETY_MESSAGE, SAFETY_MESSAGE_CHILD, UNRESOLVED_TO_RECIPIENT } from "./copy";
import { hasBlockers, hashText, redactBlocked, scanOutbound, type Finding } from "./privacy";
import { detectAbuse, detectBadFaith, detectSafetyConcern, type SafetyKind } from "./safety";
import { transition } from "./stateMachine";
import { checkRepeatThreshold, findOrCreateIncident, recomputeIncident } from "./incidents";
import { moveToHumanReview, raiseFlag } from "./flags";

const NOT_FOUND_HOME = "We couldn't find a matching home in this community.";

// ---------------------------------------------------------------------------
// Access helpers. Every case operation goes through one of these, so changing a
// case ID in a URL can never reach someone else's case (T16).

async function loadCase(caseId: string) {
  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c) throw forbidden(); // same response as "not yours": no existence leak
  return c;
}

export async function asReporter(actor: Actor, caseId: string) {
  const c = await loadCase(caseId);
  // Reporter access is per person, not per household (docs/05 scenario 10).
  if (c.reporterUserId !== actor.userId) throw forbidden();
  return c;
}

export async function asRecipient(actor: Actor, caseId: string) {
  const c = await loadCase(caseId);
  // The recipient household sees nothing until an approved notice was sent (T03).
  if (!actor.household || actor.household.id !== c.targetHouseholdId || !c.noticeSentAt) throw forbidden();
  return c;
}

async function reporterScanContext(c: { reporterUserId: string; reporterHouseholdId: string }) {
  const [user, hh] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: c.reporterUserId } }),
    prisma.household.findUniqueOrThrow({ where: { id: c.reporterHouseholdId } }),
  ]);
  return { senderHouseholdLabel: hh.label, senderHouseholdUnit: hh.unit, senderName: user.displayName };
}

async function recipientScanContext(actor: Actor) {
  const hh = await prisma.household.findUniqueOrThrow({ where: { id: actor.household!.id } });
  return { senderHouseholdLabel: hh.label, senderHouseholdUnit: hh.unit, senderName: actor.displayName };
}

// Stops mediation: nothing is sent to the other household and a person reviews it.
async function escalateSafety(
  c: { id: string; state: string; targetHouseholdId: string; category: string; incidentId: string | null },
  kind: SafetyKind,
  actorId: string,
  at: Date,
) {
  if (c.state !== "SAFETY_ESCALATED") await transition(prisma, c.id, c.state, "SAFETY_ESCALATED");
  if (c.incidentId) await prisma.incident.update({ where: { id: c.incidentId }, data: { status: "SAFETY" } });
  await prisma.message.create({
    data: { caseId: c.id, side: "REPORTER", author: "SYSTEM", kind: "STATUS", body: kind === "CHILD" ? SAFETY_MESSAGE_CHILD : SAFETY_MESSAGE, createdAt: at },
  });
  await raiseFlag({ caseId: c.id, targetHouseholdId: c.targetHouseholdId, category: c.category, reason: "SAFETY", dedupKey: `SAFETY:${c.id}`, detail: kind === "CHILD" ? "Possible child-welfare concern" : "Possible threat or danger", at, actorId });
}

// ---------------------------------------------------------------------------
// Reporter: create

export async function listTargetableHouseholds(actor: Actor) {
  const own = requireResident(actor);
  return prisma.household.findMany({
    where: { communityId: own.communityId, status: "ACTIVE", id: { not: own.id } },
    select: { id: true, label: true },
    orderBy: { label: "asc" },
  });
}

export async function createCase(
  actor: Actor,
  input: { targetHouseholdId: string; category: string; occurredAt: Date; description: string; safetyConcern?: boolean; topic?: string },
) {
  const own = requireResident(actor);
  const at = await now();

  if (!CATEGORIES.includes(input.category as Category)) throw badRequest("Please choose a category.");
  const description = input.description.trim();
  if (description.length < 10) throw badRequest("Please describe what happened (at least 10 characters).");
  if (description.length > 2000) throw badRequest("Please keep the description under 2000 characters.");
  if (Number.isNaN(input.occurredAt.getTime()) || input.occurredAt > at) throw badRequest("Please enter when it happened (not in the future).");

  // "Other" needs a short, neutral topic: it may appear in the notice.
  let topic: string | null = null;
  if (input.category === "OTHER") {
    topic = (input.topic ?? "").trim().replace(/\s+/g, " ");
    if (topic.length < TOPIC_MIN || topic.length > TOPIC_MAX) {
      throw badRequest(`Please say briefly what it's about (${TOPIC_MIN}–${TOPIC_MAX} characters), e.g. "Rubbish left outside".`);
    }
    if (detectAbuse(topic)) throw badRequest("Please describe the topic neutrally, without insults.");
  }

  // F04: target must be an active household in the SAME community, not your own.
  const target = await prisma.household.findUnique({ where: { id: input.targetHouseholdId } });
  if (!target || target.status !== "ACTIVE" || target.communityId !== own.communityId || target.id === own.id) {
    throw badRequest(NOT_FOUND_HOME);
  }

  // Simple abuse throttle: a cap on reports per person per day.
  const recent = await prisma.case.count({
    where: { reporterUserId: actor.userId, openedAt: { gte: new Date(at.getTime() - 24 * 3600_000) } },
  });
  if (recent >= POLICY.maxReportsPerDay) throw new AppError(429, "You've reached today's limit for new reports. Please try again tomorrow.");

  const base = {
    communityId: own.communityId,
    reporterUserId: actor.userId,
    reporterHouseholdId: own.id,
    targetHouseholdId: target.id,
    category: input.category,
    topic,
    occurredAt: input.occurredAt,
    rawText: description,
    openedAt: at,
  };

  // T15: safety concerns bypass mediation entirely and go straight to a human.
  const safety: SafetyKind | null =
    detectSafetyConcern(description) ?? (topic ? detectSafetyConcern(topic) : null) ?? (input.safetyConcern ? "THREAT" : null);
  if (safety) {
    const incident = await prisma.incident.create({
      data: { communityId: own.communityId, targetHouseholdId: target.id, category: input.category, occurredAt: input.occurredAt, status: "SAFETY" },
    });
    const c = await prisma.case.create({ data: { ...base, incidentId: incident.id, state: "DRAFT" } });
    await audit(actor.userId, "CaseCreated", "case", c.id, at, { category: input.category, safety: true });
    await escalateSafety(c, safety, actor.userId, at);
    return prisma.case.findUniqueOrThrow({ where: { id: c.id } });
  }

  const { incident, duplicate } = await findOrCreateIncident({
    communityId: own.communityId,
    targetHouseholdId: target.id,
    category: input.category,
    occurredAt: input.occurredAt,
  });
  const c = await prisma.case.create({ data: { ...base, incidentId: incident.id, state: "DRAFT" } });
  await audit(actor.userId, "CaseCreated", "case", c.id, at, { category: input.category, incidentId: incident.id, duplicate });

  // Try to draft straight away; a failure leaves a saved, unsent draft.
  try {
    await generateDraft(actor, c.id);
  } catch (e) {
    if (!(e instanceof AppError && e.status === 503)) throw e;
  }
  return prisma.case.findUniqueOrThrow({ where: { id: c.id } });
}

// ---------------------------------------------------------------------------
// Reporter: draft, edit, approve, send

async function latestDraft(caseId: string) {
  return prisma.noticeDraft.findFirst({ where: { caseId }, orderBy: { version: "desc" } });
}

async function saveDraftVersion(
  caseId: string,
  text: string,
  source: "AI" | "EDIT",
  findings: Finding[],
  removed: { span: string; reason: string }[],
  meta: { tone: Tone; provider: string; note: string },
) {
  const prev = await latestDraft(caseId);
  return prisma.noticeDraft.create({
    data: {
      caseId,
      version: (prev?.version ?? 0) + 1,
      text,
      textHash: hashText(text),
      source,
      risksJson: JSON.stringify(findings),
      removedJson: JSON.stringify(removed),
      ...meta,
    },
  });
}

export type DraftResult =
  | { outcome: "NOTICE"; draftId: string }
  | { outcome: "CLARIFY" | "DECLINE"; message: string }
  | { outcome: "SAFETY" };

export async function generateDraft(actor: Actor, caseId: string, opts: { tone?: string } = {}): Promise<DraftResult> {
  const c = await asReporter(actor, caseId);
  if (c.state !== "DRAFT" && c.state !== "AWAITING_APPROVAL") throw conflict("This notice can no longer be changed.");
  const at = await now();
  const prev = await latestDraft(c.id);
  const tone: Tone = TONES.includes(opts.tone as Tone) ? (opts.tone as Tone) : ((prev?.tone as Tone) ?? "FRIENDLY");
  const input = {
    category: c.category as Category,
    topic: c.topic,
    occurredAt: c.occurredAt,
    rawText: c.rawText,
    tone,
    attempt: (await prisma.noticeDraft.count({ where: { caseId: c.id, source: "AI" } })) + 1,
  };

  // 1. Deterministic screens run first, whatever the AI provider would say.
  const safety = detectSafetyConcern(c.rawText);
  if (safety) {
    await escalateSafety(c, safety, actor.userId, at);
    return { outcome: "SAFETY" };
  }

  // 2. Ask the AI with untrusted text only (reporter identity is never sent),
  //    and validate its output strictly — anything unexpected is a failure.
  let result;
  if (detectBadFaith(c.rawText)) {
    result = { output: analyseReport(input), provider: "screen" };
  } else {
    try {
      result = await runMediator((p) => p.draftNotice(input), (raw) => {
        const out = NoticeOutputSchema.parse(raw);
        if (out.outcome === "NOTICE" && out.noticeText.trim().length < 20) throw new Error("Empty notice");
        return out;
      });
    } catch {
      await audit(actor.userId, "AiDraftFailed", "case", c.id, at);
      throw new AppError(503, AI_UNAVAILABLE);
    }
  }
  const out = result.output;

  // 3. The AI may raise safety, but can never clear it.
  if (out.outcome === "SAFETY") {
    await escalateSafety(c, "THREAT", actor.userId, at);
    return { outcome: "SAFETY" };
  }

  // 4. Not sendable yet: the mediator asks for detail or declines. Any earlier
  //    draft stops being approvable because the case goes back to DRAFT.
  if (out.outcome === "CLARIFY" || out.outcome === "DECLINE") {
    if (c.state === "AWAITING_APPROVAL") await transition(prisma, c.id, "AWAITING_APPROVAL", "DRAFT");
    await prisma.message.create({ data: { caseId: c.id, side: "REPORTER", author: "AI", kind: "CLARIFY", body: out.mediatorMessage, createdAt: at } });
    await audit(actor.userId, out.outcome === "DECLINE" ? "ReportDeclined" : "ClarificationRequested", "case", c.id, at, { provider: result.provider });
    return { outcome: out.outcome, message: out.mediatorMessage };
  }

  // 5. Server-side privacy scan; hard identifiers are redacted even if the AI missed them (T18).
  const ctx = await reporterScanContext(c);
  const firstScan = scanOutbound(out.noticeText.trim(), ctx);
  const text = redactBlocked(out.noticeText.trim(), firstScan);
  const findings = scanOutbound(text, ctx);
  const removed = [
    ...out.removedDetails,
    ...firstScan.filter((f) => f.severity === "BLOCK").map((f) => ({ span: f.span, reason: `${f.reason} (removed automatically)` })),
  ];

  const draft = await saveDraftVersion(c.id, text, "AI", findings, removed, { tone, provider: result.provider, note: out.mediatorMessage });
  if (c.state === "DRAFT") await transition(prisma, c.id, "DRAFT", "AWAITING_APPROVAL");
  await audit(actor.userId, "NoticeDrafted", "notice_draft", draft.id, at, { version: draft.version, provider: result.provider, tone });
  if (findings.length) await audit(actor.userId, "PrivacyRiskShown", "notice_draft", draft.id, at, { count: findings.length });
  return { outcome: "NOTICE", draftId: draft.id };
}

// The reporter answers the mediator's question by rewriting their private report.
export async function updateDescription(actor: Actor, caseId: string, description: string) {
  const c = await asReporter(actor, caseId);
  if (c.state !== "DRAFT" && c.state !== "AWAITING_APPROVAL") throw conflict("This report can no longer be changed.");
  const clean = description.trim();
  if (clean.length < 10 || clean.length > 2000) throw badRequest("Please describe what happened (10 to 2000 characters).");
  const at = await now();
  await prisma.$transaction(async (tx) => {
    await tx.case.update({ where: { id: c.id }, data: { rawText: clean } });
    await tx.message.create({ data: { caseId: c.id, side: "REPORTER", author: "RESIDENT", kind: "RESPONSE", body: clean, createdAt: at } });
    if (c.state === "AWAITING_APPROVAL") await transition(tx, c.id, "AWAITING_APPROVAL", "DRAFT");
  });
  await audit(actor.userId, "ReportUpdated", "case", c.id, at);
  return generateDraft(actor, c.id);
}

export async function editDraft(actor: Actor, caseId: string, text: string) {
  const c = await asReporter(actor, caseId);
  if (c.state !== "AWAITING_APPROVAL") throw conflict("This notice can no longer be changed.");
  const clean = text.trim();
  if (clean.length < 20 || clean.length > 1200) throw badRequest("The notice must be between 20 and 1200 characters.");
  const at = await now();
  // An edit is a new version with no approval: any earlier approval is now stale (T04).
  const findings = scanOutbound(clean, await reporterScanContext(c));
  const prev = await latestDraft(c.id);
  const draft = await saveDraftVersion(c.id, clean, "EDIT", findings, prev ? JSON.parse(prev.removedJson) : [], {
    tone: (prev?.tone as Tone) ?? "FRIENDLY",
    provider: "edited by you",
    note: "",
  });
  await audit(actor.userId, "NoticeEdited", "notice_draft", draft.id, at, { version: draft.version });
  return draft;
}

export async function approveDraft(
  actor: Actor,
  caseId: string,
  input: { draftId: string; textHash: string; acknowledgeInferenceRisk: boolean },
) {
  const c = await asReporter(actor, caseId);
  if (c.state !== "AWAITING_APPROVAL") throw conflict("This notice can't be approved now.");
  const draft = await latestDraft(c.id);
  // Approval binds to the exact version and text the reporter saw.
  if (!draft || draft.id !== input.draftId) throw conflict("The draft changed. Please review the latest version.");
  if (draft.textHash !== input.textHash || hashText(draft.text) !== input.textHash) throw conflict("The draft changed. Please review the latest version.");
  const findings: Finding[] = JSON.parse(draft.risksJson);
  if (hasBlockers(findings)) throw badRequest("Remove the highlighted identifying details before approving.");
  if (!input.acknowledgeInferenceRisk) throw badRequest("Please confirm you understand the recipient may still infer who raised this.");

  const at = await now();
  const updated = await prisma.noticeDraft.update({ where: { id: draft.id }, data: { approvedHash: draft.textHash, approvedAt: at } });
  await audit(actor.userId, "NoticeApproved", "notice_draft", draft.id, at, { version: draft.version, textHash: draft.textHash, warningsAcknowledged: findings.length });
  return updated;
}

export async function sendNotice(actor: Actor, caseId: string, input: { draftId: string; idempotencyKey: string }) {
  const c = await asReporter(actor, caseId);
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) throw badRequest("Missing idempotency key.");

  // T20: a retried request with the same key returns the original delivery.
  const already = await prisma.noticeDraft.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (already) {
    if (already.caseId !== c.id) throw conflict("Duplicate request.");
    return already;
  }
  if (c.state !== "AWAITING_APPROVAL") throw conflict("This notice has already been sent or can't be sent now.");

  const draft = await latestDraft(c.id);
  // T03/T04: only the latest version, approved for its exact current text, can go out.
  if (!draft || draft.id !== input.draftId) throw conflict("The draft changed since you approved it. Please review and approve again.");
  if (!draft.approvedHash || draft.approvedHash !== hashText(draft.text)) {
    throw conflict("The draft changed since you approved it. Please review and approve again.");
  }
  // Re-check privacy and the recipient at delivery time, not just at approval.
  if (hasBlockers(scanOutbound(draft.text, await reporterScanContext(c)))) throw badRequest("Remove identifying details before sending.");
  const target = await prisma.household.findUnique({ where: { id: c.targetHouseholdId } });
  if (!target || target.status !== "ACTIVE" || target.communityId !== c.communityId) throw badRequest(NOT_FOUND_HOME);

  const at = await now();
  await prisma.$transaction(async (tx) => {
    await transition(tx, c.id, "AWAITING_APPROVAL", "NOTICE_SENT", { noticeSentAt: at });
    await tx.noticeDraft.update({ where: { id: draft.id }, data: { sentAt: at, idempotencyKey: input.idempotencyKey } });
    await tx.message.createMany({
      data: [
        { caseId: c.id, side: "RECIPIENT", author: "AI", kind: "NOTICE", body: draft.text, createdAt: at },
        { caseId: c.id, side: "REPORTER", author: "SYSTEM", kind: "STATUS", body: NOTICE_DELIVERED, createdAt: at },
      ],
    });
  });
  await audit(actor.userId, "NoticeSent", "notice_draft", draft.id, at, { version: draft.version, recipientHouseholdId: target.id });
  return prisma.noticeDraft.findUniqueOrThrow({ where: { id: draft.id } });
}

export async function cancelCase(actor: Actor, caseId: string) {
  const c = await asReporter(actor, caseId);
  await transition(prisma, c.id, c.state, "CANCELLED", { closedAt: await now() });
  await audit(actor.userId, "CaseCancelled", "case", c.id, await now());
  if (c.incidentId) await recomputeIncident(c.incidentId);
}

// ---------------------------------------------------------------------------
// Recipient: respond, preview the relay, confirm it

export async function respond(actor: Actor, caseId: string, input: { responseType: string; text?: string }) {
  const c = await asRecipient(actor, caseId);
  if (!["NOTICE_SENT", "ASSISTED_RESOLUTION", "UNRESOLVED"].includes(c.state)) {
    throw conflict("Replies aren't open for this case right now.");
  }
  if (!RESPONSE_TYPES.includes(input.responseType as ResponseType)) throw badRequest("Choose a response type.");
  const text = (input.text ?? "").trim();
  if (text.length > 1000) throw badRequest("Please keep your reply under 1000 characters.");
  if (input.responseType !== "ACKNOWLEDGE" && text.length < 3) throw badRequest("Please add a short note.");
  const at = await now();

  // Abusive replies are never forwarded; a person reviews them (docs/05 scenario 4).
  if (detectAbuse(text)) return holdForModeration(actor, c, input.responseType, text, at);

  let out;
  try {
    const relayInput = { category: c.category as Category, responseType: input.responseType as ResponseType, text };
    out = (await runMediator((p) => p.draftRelay(relayInput), (raw) => RelayOutputSchema.parse(raw))).output;
  } catch {
    throw new AppError(503, "We couldn't prepare a safe summary right now. Nothing was shared. Please try again.");
  }
  if (out.requiresModeration) return holdForModeration(actor, c, input.responseType, text, at);

  // Discard any earlier unconfirmed preview, then store the new one.
  await prisma.relay.updateMany({ where: { caseId: c.id, status: "PREVIEW" }, data: { status: "DISCARDED" } });
  const findings = scanOutbound(out.relayText, await recipientScanContext(actor));
  const relay = await prisma.relay.create({
    data: { caseId: c.id, responseType: input.responseType, rawText: text, relayText: redactBlocked(out.relayText, findings), createdAt: at },
  });
  return { relay, findings: scanOutbound(relay.relayText, await recipientScanContext(actor)) };
}

async function holdForModeration(actor: Actor, c: { id: string; state: string; targetHouseholdId: string; category: string }, responseType: string, text: string, at: Date) {
  const relay = await prisma.relay.create({ data: { caseId: c.id, responseType, rawText: text, relayText: "", status: "HELD", createdAt: at } });
  await prisma.message.createMany({
    data: [
      { caseId: c.id, side: "RECIPIENT", author: "RESIDENT", kind: "RESPONSE", body: text, createdAt: at },
      { caseId: c.id, side: "RECIPIENT", author: "SYSTEM", kind: "INFO", body: "This reply wasn't shared because it may contain abusive language. A community manager may review it. You can send a different reply.", createdAt: at },
    ],
  });
  await raiseFlag({ caseId: c.id, targetHouseholdId: c.targetHouseholdId, category: c.category, reason: "ABUSE", dedupKey: `ABUSE:${relay.id}`, at, actorId: actor.userId });
  await audit(actor.userId, "ResponseHeld", "relay", relay.id, at);
  return { relay, findings: [] as Finding[] };
}

export async function confirmRelay(actor: Actor, caseId: string, input: { relayId: string; relayText?: string }) {
  const c = await asRecipient(actor, caseId);
  const relay = await prisma.relay.findUnique({ where: { id: input.relayId } });
  if (!relay || relay.caseId !== c.id) throw forbidden();
  if (relay.status !== "PREVIEW") throw conflict("This reply was already handled.");

  const text = (input.relayText ?? relay.relayText).trim();
  if (text.length < 10 || text.length > 800) throw badRequest("The summary must be between 10 and 800 characters.");
  if (detectAbuse(text)) throw badRequest("Please remove abusive language from the summary.");
  if (hasBlockers(scanOutbound(text, await recipientScanContext(actor)))) throw badRequest("Remove names, phone numbers or emails before sharing.");

  const at = await now();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.relay.updateMany({ where: { id: relay.id, status: "PREVIEW" }, data: { status: "SENT", sentAt: at, relayText: text } });
    if (claimed.count !== 1) throw conflict("This reply was already handled.");
    await transition(tx, c.id, c.state, "ASSISTED_RESOLUTION", {
      firstResponseAt: c.firstResponseAt ?? at,
      disputed: c.disputed || relay.responseType === "DISPUTE",
    });
    await tx.message.createMany({
      data: [
        ...(relay.rawText ? [{ caseId: c.id, side: "RECIPIENT", author: "RESIDENT", kind: "RESPONSE", body: relay.rawText, createdAt: at }] : []),
        { caseId: c.id, side: "RECIPIENT", author: "SYSTEM", kind: "INFO", body: `Shared with the reporting household: "${text}"`, createdAt: at },
        { caseId: c.id, side: "REPORTER", author: "AI", kind: "RELAY", body: text, createdAt: at },
      ],
    });
  });
  await audit(actor.userId, "RecipientResponded", "relay", relay.id, at, { responseType: relay.responseType });
  await audit(actor.userId, "ResponseSanitised", "relay", relay.id, at, { edited: text !== relay.relayText });
  if (c.incidentId) await recomputeIncident(c.incidentId);
}

// ---------------------------------------------------------------------------
// Reporter: confirm outcome. Either party: request a fair review.

export async function confirmStatus(actor: Actor, caseId: string, input: { status: string; note?: string }) {
  const c = await asReporter(actor, caseId);
  if (!["NOTICE_SENT", "ASSISTED_RESOLUTION", "UNRESOLVED"].includes(c.state)) throw conflict("This case can't be updated now.");
  if (input.status !== "RESOLVED" && input.status !== "UNRESOLVED") throw badRequest("Choose resolved or not resolved.");
  const at = await now();

  if (input.status === "RESOLVED") {
    await transition(prisma, c.id, c.state, "RESOLVED", { closedAt: at });
    await prisma.message.createMany({
      data: [
        { caseId: c.id, side: "REPORTER", author: "SYSTEM", kind: "STATUS", body: "You marked this concern as resolved. Thank you.", createdAt: at },
        { caseId: c.id, side: "RECIPIENT", author: "AI", kind: "INFO", body: "The reporting household has marked this concern as resolved. Thank you for responding. No record of wrongdoing has been made.", createdAt: at },
      ],
    });
    await audit(actor.userId, "CaseResolved", "case", c.id, at);
  } else {
    if (c.state === "UNRESOLVED") throw conflict("Already marked as not resolved.");
    await transition(prisma, c.id, c.state, "UNRESOLVED");
    await prisma.message.createMany({
      data: [
        { caseId: c.id, side: "REPORTER", author: "SYSTEM", kind: "STATUS", body: "You marked this concern as not resolved yet. The other household has been told, without any details about you.", createdAt: at },
        { caseId: c.id, side: "RECIPIENT", author: "AI", kind: "INFO", body: UNRESOLVED_TO_RECIPIENT, createdAt: at },
      ],
    });
    await audit(actor.userId, "ReporterUpdated", "case", c.id, at, { status: "UNRESOLVED" });
  }

  if (c.incidentId) {
    const inc = await recomputeIncident(c.incidentId);
    if (inc?.status === "QUALIFYING_UNRESOLVED") {
      await audit(null, "IncidentQualified", "incident", inc.id, at);
      const flag = await checkRepeatThreshold(inc.id, c.id, at);
      if (flag) await moveToHumanReview(c.id, at);
    }
  }
}

export async function requestReview(actor: Actor, caseId: string, note?: string) {
  const c = await loadCase(caseId);
  const isReporter = c.reporterUserId === actor.userId;
  const isRecipient = !!actor.household && actor.household.id === c.targetHouseholdId && !!c.noticeSentAt;
  if (!isReporter && !isRecipient) throw forbidden();
  if (!c.noticeSentAt) throw conflict("A review can be requested once the notice has been delivered.");
  if (["CLOSED", "CANCELLED", "HUMAN_REVIEW"].includes(c.state)) throw conflict("This case is already with management or closed.");
  const at = await now();
  const side = isReporter ? "REPORTER" : "RECIPIENT";
  const flag = await raiseFlag({
    caseId: c.id,
    targetHouseholdId: c.targetHouseholdId,
    category: c.category,
    reason: "REVIEW_REQUESTED",
    dedupKey: `REVIEW_REQUESTED:${c.id}:${side}`,
    detail: `Requested by the ${isReporter ? "reporting" : "recipient"} household${note ? " with a note" : ""}`,
    at,
    actorId: actor.userId,
  });
  if (!flag) throw conflict("You've already requested a review for this case.");
  if (note?.trim()) {
    await prisma.message.create({ data: { caseId: c.id, side, author: "RESIDENT", kind: "RESPONSE", body: `Review request note: ${note.trim().slice(0, 500)}`, createdAt: at } });
  }
  await moveToHumanReview(c.id, at);
}
