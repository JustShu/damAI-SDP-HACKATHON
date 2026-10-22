export const CATEGORIES = ["NOISE", "PARKING", "PET", "OTHER"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  NOISE: "Noise",
  PARKING: "Parking / blocked access",
  PET: "Pet disturbance",
  OTHER: "Other",
};

// "Other" concerns carry a short reporter-written topic (e.g. "Rubbish left
// outside the gate") so the notice can say what the concern is about.
export const TOPIC_MIN = 3;
export const TOPIC_MAX = 60;

export const RESPONSE_TYPES = ["ACKNOWLEDGE", "CLARIFY", "DISPUTE", "COMMIT"] as const;
export type ResponseType = (typeof RESPONSE_TYPES)[number];

export const RESPONSE_LABELS: Record<ResponseType, string> = {
  ACKNOWLEDGE: "Acknowledge",
  CLARIFY: "Explain",
  DISPUTE: "Dispute",
  COMMIT: "Propose an action",
};

export const MANAGER_DECISIONS = [
  "CLOSE_RESOLVED",
  "CLOSE_UNSUBSTANTIATED",
  "REQUEST_CONTEXT",
  "MANAGEMENT_ADVISORY",
  "FORMAL_WARNING",
] as const;
export type ManagerDecision = (typeof MANAGER_DECISIONS)[number];

export const DECISION_LABELS: Record<ManagerDecision, string> = {
  CLOSE_RESOLVED: "Close as resolved",
  CLOSE_UNSUBSTANTIATED: "Close as unsubstantiated",
  REQUEST_CONTEXT: "Request more context from both parties",
  MANAGEMENT_ADVISORY: "Send management advisory",
  FORMAL_WARNING: "Issue formal warning (under community rules)",
};

export const FLAG_LABELS: Record<string, string> = {
  REPEAT_UNRESOLVED: "3 qualifying unresolved incidents in 30 days",
  OVERDUE: "Unresolved after 7 days",
  SAFETY: "Possible safety issue",
  ABUSE: "Abusive content held",
  REVIEW_REQUESTED: "Fairness review requested",
};

// Configurable demo defaults from docs/03 — prototype choices, not validated policy.
export const POLICY = {
  responseWindowHours: 72,
  overdueDays: 7,
  repeatWindowDays: 30,
  repeatThreshold: 3,
  duplicateWindowHours: 2,
  maxReportsPerDay: 5,
};

// Case states (docs/03). Side routes: CANCELLED, SAFETY_ESCALATED, MODERATION_HOLD.
export const STATES = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "NOTICE_SENT",
  "ASSISTED_RESOLUTION",
  "RESOLVED",
  "UNRESOLVED",
  "HUMAN_REVIEW",
  "CLOSED",
  "CANCELLED",
  "SAFETY_ESCALATED",
  "MODERATION_HOLD",
] as const;
export type CaseState = (typeof STATES)[number];
