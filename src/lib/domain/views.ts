import { prisma } from "../db";
import { forbidden } from "../errors";
import { type Actor, requireResident } from "../actor";
import type { Finding } from "./privacy";

// Read models for resident screens, redacted by role (docs/05 visibility matrix).
// The recipient view never includes reporter identity, the raw report or drafts.

export type Role = "REPORTER" | "RECIPIENT";

// Plain-language status for each side. The recipient's wording never implies
// guilt, and says plainly what the other side has done.
const REPORTER_STATUS: Record<string, string> = {
  DRAFT: "Needs more detail",
  AWAITING_APPROVAL: "Ready for your review",
  NOTICE_SENT: "Waiting for their reply",
  ASSISTED_RESOLUTION: "They replied",
  UNRESOLVED: "You said it's not resolved",
  RESOLVED: "Resolved",
  HUMAN_REVIEW: "With community management",
  CLOSED: "Closed by management",
  CANCELLED: "Cancelled",
  SAFETY_ESCALATED: "Passed to management",
  MODERATION_HOLD: "With community management",
};

const RECIPIENT_STATUS: Record<string, string> = {
  NOTICE_SENT: "Your reply is needed",
  ASSISTED_RESOLUTION: "Reply shared, waiting for neighbour",
  UNRESOLVED: "Neighbour says not resolved yet",
  RESOLVED: "Resolved",
  HUMAN_REVIEW: "With community management",
  MODERATION_HOLD: "With community management",
  CLOSED: "Closed by management",
};

const REPORTER_NEXT: Record<string, string> = {
  DRAFT: "Answer the mediator's question so it can write a neutral notice. Nothing has been sent.",
  AWAITING_APPROVAL: "Check the notice and approve it. Nothing is sent until you do.",
  NOTICE_SENT: "The other household has been notified privately. If they don't reply within 72 hours, the mediator sends one polite reminder.",
  ASSISTED_RESOLUTION: "Read their reply below, then tell the mediator whether things are sorted.",
  UNRESOLVED: "The other household knows it isn't resolved yet. If it carries on, management reviews it after 7 days, or you can ask for a review now.",
  RESOLVED: "Thanks for confirming. No record of wrongdoing has been made against anyone.",
  HUMAN_REVIEW: "A person from community management is reviewing the case. You'll see their decision here.",
  CLOSED: "Community management has closed this case.",
  CANCELLED: "You cancelled this report. Nothing was sent.",
  SAFETY_ESCALATED: "Community management has been alerted. If anyone is in immediate danger, call 999.",
  MODERATION_HOLD: "A person from community management is reviewing the case.",
};

const RECIPIENT_NEXT: Record<string, string> = {
  NOTICE_SENT: "Reply privately to the mediator: acknowledge it, explain, dispute it, or say what you'll do. Replying is optional and isn't an admission of anything.",
  ASSISTED_RESOLUTION: "Your summary was shared. The neighbour now confirms whether things are sorted. You can add more at any time.",
  UNRESOLVED: "The neighbour says it isn't sorted yet. You can reply again with more context or a plan, or ask management for a fair review if you disagree.",
  RESOLVED: "The neighbour marked this resolved. No record of wrongdoing has been made.",
  HUMAN_REVIEW: "A person from community management is reviewing the case. You'll see their decision here.",
  MODERATION_HOLD: "A person from community management is reviewing the case.",
  CLOSED: "Community management has closed this case.",
};

export const statusLabel = (role: Role, state: string) =>
  (role === "REPORTER" ? REPORTER_STATUS : RECIPIENT_STATUS)[state] ?? state;

export const nextStep = (role: Role, state: string) => (role === "REPORTER" ? REPORTER_NEXT : RECIPIENT_NEXT)[state] ?? "";

// What the signed-in person needs to do, if anything (shown on the home screen).
const ACTIONS: Record<Role, Record<string, string>> = {
  REPORTER: {
    DRAFT: "The mediator needs a little more detail",
    AWAITING_APPROVAL: "Review and approve the notice",
    ASSISTED_RESOLUTION: "They replied. Is it sorted?",
  },
  RECIPIENT: {
    NOTICE_SENT: "Reply to a concern shared with you",
    UNRESOLVED: "Your neighbour says it isn't sorted yet",
  },
};
export type Tone = "action" | "waiting" | "progress" | "done" | "review";
const REVIEW_STATES = ["HUMAN_REVIEW", "SAFETY_ESCALATED", "MODERATION_HOLD", "CLOSED"];
export function statusTone(role: Role, state: string): Tone {
  if (REVIEW_STATES.includes(state)) return "review";
  if (state === "RESOLVED" || state === "CANCELLED") return "done";
  if (actionFor(role, state)) return "action";
  return state === "UNRESOLVED" ? "progress" : "waiting";
}

export const actionFor = (role: Role, state: string) => ACTIONS[role][state] ?? null;

export async function listCasesForActor(actor: Actor) {
  const own = requireResident(actor);
  const [mine, received] = await Promise.all([
    prisma.case.findMany({ where: { reporterUserId: actor.userId }, orderBy: { openedAt: "desc" } }),
    prisma.case.findMany({ where: { targetHouseholdId: own.id, noticeSentAt: { not: null } }, orderBy: { noticeSentAt: "desc" } }),
  ]);
  const labels = Object.fromEntries(
    (await prisma.household.findMany({ where: { id: { in: mine.map((c) => c.targetHouseholdId) } } })).map((h) => [h.id, h.label]),
  );
  return {
    raised: mine.map((c) => ({
      id: c.id,
      category: c.category,
      occurredAt: c.occurredAt,
      state: c.state,
      status: statusLabel("REPORTER", c.state),
      action: actionFor("REPORTER", c.state),
      tone: statusTone("REPORTER", c.state),
      targetLabel: labels[c.targetHouseholdId],
      topic: c.topic,
    })),
    received: received.map((c) => ({
      id: c.id,
      category: c.category,
      occurredAt: c.occurredAt,
      state: c.state,
      status: statusLabel("RECIPIENT", c.state),
      action: actionFor("RECIPIENT", c.state),
      tone: statusTone("RECIPIENT", c.state),
    })),
  };
}

export async function getCaseView(actor: Actor, caseId: string) {
  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c) throw forbidden();
  const role: Role | null =
    c.reporterUserId === actor.userId
      ? "REPORTER"
      : actor.household?.id === c.targetHouseholdId && c.noticeSentAt
        ? "RECIPIENT"
        : null;
  if (!role) throw forbidden();

  const messages = await prisma.message.findMany({ where: { caseId: c.id, side: role }, orderBy: { createdAt: "asc" } });
  const thread = messages.map((m) => ({ id: m.id, author: m.author, kind: m.kind, body: m.body, createdAt: m.createdAt }));
  const common = {
    id: c.id,
    category: c.category,
    occurredAt: c.occurredAt,
    state: c.state,
    status: statusLabel(role, c.state),
    nextStep: nextStep(role, c.state),
    tone: statusTone(role, c.state),
    thread,
    timeline: timeline(c),
  };

  if (role === "RECIPIENT") {
    const preview = await prisma.relay.findFirst({ where: { caseId: c.id, status: "PREVIEW" }, orderBy: { createdAt: "desc" } });
    return {
      ...common,
      role: "RECIPIENT" as const,
      canRespond: ["NOTICE_SENT", "ASSISTED_RESOLUTION", "UNRESOLVED"].includes(c.state),
      canRequestReview: !["CLOSED", "HUMAN_REVIEW", "MODERATION_HOLD"].includes(c.state),
      pendingRelay: preview ? { id: preview.id, responseType: preview.responseType, relayText: preview.relayText } : null,
    };
  }

  const [draft, target] = await Promise.all([
    prisma.noticeDraft.findFirst({ where: { caseId: c.id }, orderBy: { version: "desc" } }),
    prisma.household.findUniqueOrThrow({ where: { id: c.targetHouseholdId } }),
  ]);
  return {
    ...common,
    role: "REPORTER" as const,
    targetLabel: target.label,
    topic: c.topic,
    rawText: c.rawText,
    draft: draft
      ? {
          id: draft.id,
          version: draft.version,
          text: draft.text,
          textHash: draft.textHash,
          source: draft.source,
          approved: !!draft.approvedHash && draft.approvedHash === draft.textHash,
          sent: !!draft.sentAt,
          findings: JSON.parse(draft.risksJson) as Finding[],
          removed: JSON.parse(draft.removedJson) as { span: string; reason: string }[],
          tone: draft.tone,
          provider: draft.provider,
          note: draft.note,
        }
      : null,
    // While the case is back in DRAFT, the mediator's latest question to the reporter.
    mediatorQuestion: c.state === "DRAFT" ? (thread.filter((m) => m.kind === "CLARIFY").at(-1)?.body ?? null) : null,
    canConfirm: ["NOTICE_SENT", "ASSISTED_RESOLUTION", "UNRESOLVED"].includes(c.state),
    canRequestReview: !!c.noticeSentAt && !["CLOSED", "HUMAN_REVIEW", "MODERATION_HOLD", "CANCELLED"].includes(c.state),
  };
}

export type CaseView = Awaited<ReturnType<typeof getCaseView>>;
export type ReporterCaseView = Extract<CaseView, { role: "REPORTER" }>;
export type RecipientCaseView = Extract<CaseView, { role: "RECIPIENT" }>;

// Submitted → Sent → Response received → Follow-up → Resolved / Under review (docs/09).
function timeline(c: {
  openedAt: Date;
  noticeSentAt: Date | null;
  firstResponseAt: Date | null;
  reminderSentAt: Date | null;
  closedAt: Date | null;
  state: string;
}) {
  const end =
    c.state === "RESOLVED"
      ? "Resolved"
      : c.state === "CLOSED"
        ? "Closed"
        : c.state === "HUMAN_REVIEW" || c.state === "SAFETY_ESCALATED" || c.state === "MODERATION_HOLD"
          ? "Under review"
          : "Resolved or reviewed";
  const endDone = ["RESOLVED", "CLOSED", "HUMAN_REVIEW", "SAFETY_ESCALATED", "MODERATION_HOLD"].includes(c.state);
  return [
    { label: "Submitted", done: true, at: c.openedAt },
    { label: "Notice sent", done: !!c.noticeSentAt, at: c.noticeSentAt },
    { label: "Reply received", done: !!c.firstResponseAt, at: c.firstResponseAt },
    { label: "Follow-up", done: !!c.reminderSentAt || c.state === "UNRESOLVED", at: c.reminderSentAt },
    { label: end, done: endDone, at: c.closedAt },
  ];
}
