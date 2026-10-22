import { Clock, MessageSquareWarning, Repeat, Scale, ShieldAlert, type LucideIcon } from "lucide-react";

export const REASON_ICON: Record<string, LucideIcon> = {
  REPEAT_UNRESOLVED: Repeat,
  OVERDUE: Clock,
  SAFETY: ShieldAlert,
  ABUSE: MessageSquareWarning,
  REVIEW_REQUESTED: Scale,
};
