import { prisma } from "../db";
import { POLICY } from "./constants";
import { raiseFlag } from "./flags";
import { draftWarningLetter } from "./warnings";

// Deterministic incident grouping and repeat counting (docs/03). No AI here.

const HOUR = 3600_000;
const DAY = 24 * HOUR;

// 1. Reports about the same target + category within the duplicate window are
//    the same occurrence, so they share one incident and count at most once.
export async function findOrCreateIncident(opts: {
  communityId: string;
  targetHouseholdId: string;
  category: string;
  occurredAt: Date;
}) {
  // "Other" covers unrelated issues, so two "Other" reports are never assumed
  // to be the same occurrence.
  if (opts.category === "OTHER") {
    return { incident: await prisma.incident.create({ data: { ...opts, status: "OPEN" } }), duplicate: false };
  }
  const win = POLICY.duplicateWindowHours * HOUR;
  const existing = await prisma.incident.findFirst({
    where: {
      communityId: opts.communityId,
      targetHouseholdId: opts.targetHouseholdId,
      category: opts.category,
      status: { not: "SAFETY" },
      occurredAt: { gte: new Date(opts.occurredAt.getTime() - win), lte: new Date(opts.occurredAt.getTime() + win) },
    },
    orderBy: { occurredAt: "asc" },
  });
  if (existing) return { incident: existing, duplicate: true };
  const incident = await prisma.incident.create({ data: { ...opts, status: "OPEN" } });
  return { incident, duplicate: false };
}

// 2. Incident status is derived from its cases. An incident qualifies only when
//    a reporter marked it unresolved after delivery AND the recipient did not
//    dispute it — a disputed allegation never silently becomes a "strike".
export async function recomputeIncident(incidentId: string) {
  const inc = await prisma.incident.findUnique({ where: { id: incidentId }, include: { cases: true } });
  if (!inc || inc.status === "SAFETY" || inc.status === "DISMISSED") return inc;
  const live = inc.cases.filter((c) => c.state !== "CANCELLED" && c.noticeSentAt);
  let status = "OPEN";
  if (live.some((c) => c.state === "UNRESOLVED" && !c.disputed)) status = "QUALIFYING_UNRESOLVED";
  else if (live.some((c) => c.state === "UNRESOLVED" && c.disputed)) status = "DISPUTED";
  else if (live.length > 0 && live.every((c) => c.state === "RESOLVED" || c.state === "CLOSED")) status = "RESOLVED";
  return prisma.incident.update({ where: { id: incidentId }, data: { status } });
}

// 3. Count DISTINCT qualifying incidents for the same household + category in
//    the rolling window ending at this incident. >= threshold -> review flag.
export async function checkRepeatThreshold(incidentId: string, triggeringCaseId: string, at: Date) {
  const inc = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!inc || inc.status !== "QUALIFYING_UNRESOLVED") return null;
  // Unrelated "Other" issues must never add up to a repeat pattern (docs/03:
  // don't combine unrelated reports). They still get the 72h / 7-day rules.
  if (inc.category === "OTHER") return null;
  const count = await prisma.incident.count({
    where: {
      communityId: inc.communityId,
      targetHouseholdId: inc.targetHouseholdId,
      category: inc.category,
      status: "QUALIFYING_UNRESOLVED",
      occurredAt: { gte: new Date(inc.occurredAt.getTime() - POLICY.repeatWindowDays * DAY), lte: inc.occurredAt },
    },
  });
  if (count < POLICY.repeatThreshold) return null;

  // Only one open repeat flag per household + category at a time.
  const open = await prisma.reviewFlag.findFirst({
    where: { reason: "REPEAT_UNRESOLVED", targetHouseholdId: inc.targetHouseholdId, category: inc.category, status: "OPEN" },
  });
  if (open) return null;
  const flag = await raiseFlag({
    caseId: triggeringCaseId,
    targetHouseholdId: inc.targetHouseholdId,
    category: inc.category,
    reason: "REPEAT_UNRESOLVED",
    dedupKey: `REPEAT:${inc.targetHouseholdId}:${inc.category}:${inc.id}`,
    detail: `${count} distinct qualifying unresolved incidents within ${POLICY.repeatWindowDays} days`,
    at,
  });
  // Prepare a warning letter for management to review. It is never sent automatically.
  if (flag) await draftWarningLetter(flag, at);
  return flag;
}
