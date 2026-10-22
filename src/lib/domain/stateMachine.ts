import type { Prisma } from "@prisma/client";
import { conflict } from "../errors";
import type { CaseState } from "./constants";

// Allowed case transitions (docs/03). Anything not listed is rejected, so no
// code path can skip reporter approval or jump straight to a penalty.
const ALLOWED: Record<CaseState, CaseState[]> = {
  DRAFT: ["AWAITING_APPROVAL", "CANCELLED", "SAFETY_ESCALATED"],
  AWAITING_APPROVAL: ["DRAFT", "NOTICE_SENT", "CANCELLED", "SAFETY_ESCALATED"],
  // CLOSED from an active state is reachable only through a manager decision.
  NOTICE_SENT: ["ASSISTED_RESOLUTION", "RESOLVED", "UNRESOLVED", "HUMAN_REVIEW", "MODERATION_HOLD", "CLOSED"],
  ASSISTED_RESOLUTION: ["ASSISTED_RESOLUTION", "RESOLVED", "UNRESOLVED", "HUMAN_REVIEW", "MODERATION_HOLD", "CLOSED"],
  UNRESOLVED: ["ASSISTED_RESOLUTION", "RESOLVED", "HUMAN_REVIEW", "MODERATION_HOLD", "CLOSED"],
  RESOLVED: ["HUMAN_REVIEW", "CLOSED"], // either party can still contest
  HUMAN_REVIEW: ["ASSISTED_RESOLUTION", "CLOSED"],
  MODERATION_HOLD: ["ASSISTED_RESOLUTION", "CLOSED"],
  SAFETY_ESCALATED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: CaseState): boolean {
  return (ALLOWED[from as CaseState] ?? []).includes(to);
}

// Compare-and-set update: fails if another request changed the state first.
export async function transition(
  tx: Prisma.TransactionClient,
  caseId: string,
  from: string,
  to: CaseState,
  data: Prisma.CaseUpdateManyMutationInput = {},
) {
  if (!canTransition(from, to)) throw conflict(`This action isn't available while the case is ${from.toLowerCase().replace(/_/g, " ")}.`);
  const res = await tx.case.updateMany({ where: { id: caseId, state: from }, data: { ...data, state: to } });
  if (res.count !== 1) throw conflict("The case changed. Please refresh and try again.");
}
