import { prisma } from "../db";
import { audit } from "../audit";
import { now } from "../clock";
import { badRequest, conflict, forbidden } from "../errors";
import { type Actor, requireManagerOf } from "../actor";
import { CATEGORY_LABELS, POLICY, RESPONSE_LABELS, type Category, type ResponseType } from "./constants";
import { decide } from "./review";

// Warning letters (feature: "3 reports → warning letter + report to management").
//  1. When a household reaches the repeat threshold, a letter is DRAFTED
//     automatically from facts only (dates, number of separate incidents).
//  2. Management also gets a household report with the full history.
//  3. A manager reviews, edits if needed, and sends it. Nothing is sent
//     automatically, and the letter never says who reported.

const DAY = 24 * 3600_000;
export const POLICY_PLACEHOLDER = "[community rule]";
export const LETTER_MIN = 80;
export const LETTER_MAX = 4000;

const ASK: Record<string, string> = {
  NOISE: "keep noise to a considerate level, especially between 10pm and 7am",
  PARKING: "keep neighbouring gates, driveways and walkways clear when parking",
  PET: "make sure your pet does not disturb neighbours, for example by barking for long periods, roaming or leaving waste",
};

const replyKey = (type: string, text: string, at: Date) => `${type}|${text}|${at.toISOString().slice(0, 16)}`;
const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Asia/Kuala_Lumpur" }).format(d);
const joinList = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Qualifying (unresolved, undisputed) incidents for a household + category in the window. */
async function qualifyingIncidents(targetHouseholdId: string, category: string, until: Date) {
  return prisma.incident.findMany({
    where: {
      targetHouseholdId,
      category,
      status: "QUALIFYING_UNRESOLVED",
      occurredAt: { gte: new Date(until.getTime() - POLICY.repeatWindowDays * DAY), lte: until },
    },
    orderBy: { occurredAt: "asc" },
  });
}

export function composeLetter(opts: { householdLabel: string; communityName: string; category: string; dates: Date[] }) {
  const what = (CATEGORY_LABELS[opts.category as Category] ?? "neighbourhood").toLowerCase();
  const ask = ASK[opts.category] ?? "take steps to address the concerns raised";
  const community = opts.communityName.replace(/\s*\(synthetic\)\s*$/i, "");
  return [
    `Dear residents of ${opts.householdLabel},`,
    "",
    `Community management has received ${what} concerns linked to your household on ${opts.dates.length} separate occasions in the past ${POLICY.repeatWindowDays} days (${joinList(opts.dates.map(fmtDay))}). Each was raised privately through DAMAI, and none has been resolved.`,
    "",
    `We ask that you ${ask}.`,
    "",
    `This letter is a formal warning under ${POLICY_PLACEHOLDER}. If the concerns continue, community management may take further action under the community's rules.`,
    "",
    "If you believe this warning is mistaken, or there is context we should know, please reply to community management through DAMAI within 14 days.",
    "",
    `Community Management, ${community}`,
  ].join("\n");
}

/** Called when a REPEAT_UNRESOLVED flag is raised. Idempotent (one letter per flag). */
export async function draftWarningLetter(flag: { id: string; caseId: string; targetHouseholdId: string; category: string }, at: Date) {
  const existing = await prisma.warningLetter.findUnique({ where: { flagId: flag.id } });
  if (existing) return existing;
  const hh = await prisma.household.findUniqueOrThrow({ where: { id: flag.targetHouseholdId }, include: { community: true } });
  const incidents = await qualifyingIncidents(flag.targetHouseholdId, flag.category, at);
  const draftText = composeLetter({
    householdLabel: hh.label,
    communityName: hh.community.name,
    category: flag.category,
    dates: incidents.map((i) => i.occurredAt),
  });
  const letter = await prisma.warningLetter.create({
    data: { flagId: flag.id, caseId: flag.caseId, targetHouseholdId: flag.targetHouseholdId, category: flag.category, draftText, createdAt: at },
  });
  await audit(null, "WarningLetterDrafted", "warning_letter", letter.id, at, { flagId: flag.id, incidents: incidents.length });
  return letter;
}

/**
 * "Troublesome household" report for management: everything relevant about
 * the household, without revealing who reported (that still needs a logged reveal).
 */
export async function getHouseholdReport(actor: Actor, flagId: string) {
  const flag = await prisma.reviewFlag.findUnique({ where: { id: flagId }, include: { case: true } });
  if (!flag) throw forbidden();
  requireManagerOf(actor, flag.case.communityId);
  const at = await now();
  const since90 = new Date(at.getTime() - 90 * DAY);

  const [hh, letter, qualifying, recentCases, actions, residents] = await Promise.all([
    prisma.household.findUniqueOrThrow({ where: { id: flag.targetHouseholdId } }),
    prisma.warningLetter.findUnique({ where: { flagId } }),
    qualifyingIncidents(flag.targetHouseholdId, flag.category, at),
    prisma.case.findMany({ where: { targetHouseholdId: flag.targetHouseholdId, openedAt: { gte: since90 }, noticeSentAt: { not: null } }, include: { relays: true } }),
    prisma.managementAction.findMany({ where: { case: { targetHouseholdId: flag.targetHouseholdId } }, orderBy: { createdAt: "desc" } }),
    prisma.membership.count({ where: { householdId: flag.targetHouseholdId, status: "VERIFIED" } }),
  ]);

  const byCategory: Record<string, number> = {};
  for (const c of recentCases) byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;

  return {
    household: { label: hh.label, verifiedResidents: residents },
    category: flag.category,
    qualifying: qualifying.map((i) => ({ occurredAt: i.occurredAt })),
    concernsLast90Days: Object.entries(byCategory).map(([category, count]) => ({ category, count })),
    // How the household responded (the shared summaries only, never raw replies).
    // One reply can be relayed to several reporters of the same occurrence; list it once.
    responses: [
      ...new Map(
        recentCases
          .filter((c) => c.category === flag.category)
          .flatMap((c) => c.relays.filter((r) => r.status === "SENT"))
          .map((r) => [replyKey(r.responseType, r.relayText, r.createdAt), { type: RESPONSE_LABELS[r.responseType as ResponseType] ?? r.responseType, summary: r.relayText, at: r.createdAt }] as const),
      ).values(),
    ].sort((a, b) => a.at.getTime() - b.at.getTime()),
    disputedCount: recentCases.filter((c) => c.disputed).length,
    previousActions: actions.map((a) => ({ decision: a.decision, policyRef: a.policyRef, at: a.createdAt })),
    letter: letter ? { id: letter.id, status: letter.status, draftText: letter.draftText, sentText: letter.sentText, sentAt: letter.sentAt } : null,
  };
}

/** A manager sends the (possibly edited) letter. Records a FORMAL_WARNING decision. */
export async function sendWarningLetter(actor: Actor, flagId: string, input: { text: string; rationale: string; policyRef: string }) {
  const letter = await prisma.warningLetter.findUnique({ where: { flagId } });
  if (!letter) throw forbidden();
  const flag = await prisma.reviewFlag.findUniqueOrThrow({ where: { id: flagId }, include: { case: true } });
  requireManagerOf(actor, flag.case.communityId);
  if (letter.status !== "DRAFT") throw conflict("This letter has already been handled.");

  const policyRef = input.policyRef.trim();
  if (policyRef.length < 3) throw badRequest("Please name the community rule this warning is issued under.");
  const text = input.text.trim().split(POLICY_PLACEHOLDER).join(policyRef);
  if (text.length < LETTER_MIN || text.length > LETTER_MAX) throw badRequest(`The letter must be between ${LETTER_MIN} and ${LETTER_MAX} characters.`);

  // Reuses the existing human decision path: closes the flag, logs the
  // decision, and delivers the letter to the household's private thread.
  await decide(actor, flagId, { decision: "FORMAL_WARNING", rationale: input.rationale, policyRef, letterText: text });

  const at = await now();
  await prisma.warningLetter.update({ where: { id: letter.id }, data: { status: "SENT", sentText: text, policyRef, sentById: actor.userId, sentAt: at } });
  await audit(actor.userId, "WarningLetterSent", "warning_letter", letter.id, at, { flagId, policyRef });
}
