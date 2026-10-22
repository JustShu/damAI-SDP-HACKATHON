import { prisma } from "../db";
import { audit } from "../audit";
import { POLICY } from "./constants";
import { REMINDER_TEXT, REMINDER_TO_REPORTER } from "./copy";
import { moveToHumanReview, raiseFlag } from "./flags";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

// Time-based rules (docs/03). Deterministic and idempotent, so it is safe to run
// on every page load or after the demo clock moves — there is no cron in the MVP.
export async function runPolicyChecks(at: Date) {
  // 1. 72h after delivery with no reply: one polite reminder. Not a guilt finding (T14).
  const due = await prisma.case.findMany({
    where: {
      state: "NOTICE_SENT",
      firstResponseAt: null,
      reminderSentAt: null,
      noticeSentAt: { lte: new Date(at.getTime() - POLICY.responseWindowHours * HOUR) },
    },
  });
  for (const c of due) {
    // Claim the reminder first, so concurrent runs can't send it twice.
    const claimed = await prisma.case.updateMany({ where: { id: c.id, reminderSentAt: null }, data: { reminderSentAt: at } });
    if (claimed.count !== 1) continue;
    await prisma.message.createMany({
      data: [
        { caseId: c.id, side: "RECIPIENT", author: "AI", kind: "REMINDER", body: REMINDER_TEXT, createdAt: at },
        { caseId: c.id, side: "REPORTER", author: "SYSTEM", kind: "STATUS", body: REMINDER_TO_REPORTER, createdAt: at },
      ],
    });
    await audit(null, "FollowUpSent", "case", c.id, at);
  }

  // 2. Still open 7 days after delivery: one OVERDUE review flag (T13).
  const overdue = await prisma.case.findMany({
    where: {
      state: { in: ["NOTICE_SENT", "ASSISTED_RESOLUTION", "UNRESOLVED"] },
      noticeSentAt: { lte: new Date(at.getTime() - POLICY.overdueDays * DAY) },
    },
  });
  for (const c of overdue) {
    const flag = await raiseFlag({
      caseId: c.id,
      targetHouseholdId: c.targetHouseholdId,
      category: c.category,
      reason: "OVERDUE",
      dedupKey: `OVERDUE:${c.id}`,
      detail: `Not resolved ${POLICY.overdueDays} days after the notice was delivered`,
      at,
    });
    if (flag) await moveToHumanReview(c.id, at);
  }
}
