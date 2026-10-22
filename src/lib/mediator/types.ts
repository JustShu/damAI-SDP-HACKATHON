import { z } from "zod";
import type { Category, ResponseType } from "../domain/constants";

// The AI only produces candidate text and advisory outcomes. It never decides
// delivery, case state, escalation or penalties — server code does.

export const TONES = ["FRIENDLY", "FORMAL", "BRIEF"] as const;
export type Tone = (typeof TONES)[number];

export type NoticeInput = {
  category: Category;
  // Short subject for OTHER concerns (also untrusted resident text).
  topic?: string | null;
  occurredAt: Date;
  // Untrusted resident text. Reporter identity is intentionally NOT passed in.
  rawText: string;
  tone: Tone;
  // 1 for the first draft, 2+ for regenerations, so each attempt can differ.
  attempt: number;
};

// NOTICE: a draft for the reporter to review.
// CLARIFY: not enough concrete detail — ask the reporter a factual question.
// DECLINE: not a good-faith concern (e.g. wanting to harass someone).
// SAFETY: possible danger — stop mediation and route to a human.
export const NoticeOutputSchema = z.object({
  outcome: z.enum(["NOTICE", "CLARIFY", "DECLINE", "SAFETY"]),
  mediatorMessage: z.string().max(700),
  caseSummary: z.string().max(200),
  noticeText: z.string().max(1200),
  removedDetails: z.array(z.object({ span: z.string().max(200), reason: z.string().max(200) })).max(20),
});
export type NoticeOutput = z.infer<typeof NoticeOutputSchema>;

export type RelayInput = {
  category: Category;
  responseType: ResponseType;
  // Untrusted recipient text.
  text: string;
};

export const RelayOutputSchema = z.object({
  relayText: z.string().min(10).max(800),
  requiresModeration: z.boolean(),
});
export type RelayOutput = z.infer<typeof RelayOutputSchema>;

export interface MediatorProvider {
  name: string;
  draftNotice(input: NoticeInput): Promise<unknown>;
  draftRelay(input: RelayInput): Promise<unknown>;
}
