import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { LlmNoticeSchema, LlmRelaySchema, NOTICE_SYSTEM, RELAY_SYSTEM, noticeUserPrompt, relayUserPrompt } from "./prompt";
import type { MediatorProvider } from "./types";

// Claude provider. Enabled when ANTHROPIC_API_KEY is set. The key stays on the
// server; the browser never calls the model directly.
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

async function ask<S extends z.ZodType>(system: string, user: string, schema: S): Promise<z.infer<S>> {
  const res = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: user }],
    // Short rewriting task: low effort keeps it fast and inexpensive.
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    // If a safety classifier declines, the API retries on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("Claude returned no usable output");
  return res.parsed_output;
}

export const claudeProvider: MediatorProvider = {
  name: `claude:${MODEL}`,
  draftNotice: (input) => ask(NOTICE_SYSTEM, noticeUserPrompt(input), LlmNoticeSchema),
  draftRelay: (input) => ask(RELAY_SYSTEM, relayUserPrompt(input), LlmRelaySchema),
};
