import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { audit } from "../audit";
import { UNDER_REVIEW } from "./copy";
import { canTransition } from "./stateMachine";

// Move an active case into human review and tell both sides, neutrally.
export async function moveToHumanReview(caseId: string, at: Date) {
  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c || !canTransition(c.state, "HUMAN_REVIEW")) return;
  const moved = await prisma.case.updateMany({ where: { id: caseId, state: c.state }, data: { state: "HUMAN_REVIEW" } });
  if (moved.count !== 1) return;
  const sides = c.noticeSentAt ? ["REPORTER", "RECIPIENT"] : ["REPORTER"];
  await prisma.message.createMany({
    data: sides.map((side) => ({ caseId, side, author: "SYSTEM", kind: "STATUS", body: UNDER_REVIEW, createdAt: at })),
  });
  await audit(null, "CaseStateChanged", "case", caseId, at, { from: c.state, to: "HUMAN_REVIEW" });
}

// Review flags ask a human to look. They are never verdicts or warnings.
// dedupKey is unique, so repeated scheduler runs cannot create duplicates.
export async function raiseFlag(opts: {
  caseId: string;
  targetHouseholdId: string;
  category: string;
  reason: "REPEAT_UNRESOLVED" | "OVERDUE" | "SAFETY" | "ABUSE" | "REVIEW_REQUESTED";
  dedupKey: string;
  detail?: string;
  at: Date;
  actorId?: string | null;
}) {
  try {
    const flag = await prisma.reviewFlag.create({
      data: {
        caseId: opts.caseId,
        targetHouseholdId: opts.targetHouseholdId,
        category: opts.category,
        reason: opts.reason,
        dedupKey: opts.dedupKey,
        detail: opts.detail ?? "",
        createdAt: opts.at,
      },
    });
    await audit(opts.actorId ?? null, "ReviewFlagRaised", "case", opts.caseId, opts.at, { reason: opts.reason, flagId: flag.id });
    return flag;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
}
