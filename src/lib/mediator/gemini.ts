import { NOTICE_SYSTEM, RELAY_SYSTEM, noticeUserPrompt, relayUserPrompt } from "./prompt";
import type { MediatorProvider } from "./types";

// Gemini provider (Google AI Studio offers a free tier). Enabled when
// GEMINI_API_KEY is set. Model names change often, so it is configurable.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const SHAPES = {
  notice: '{"outcome":"NOTICE|CLARIFY|DECLINE|SAFETY","mediatorMessage":string,"caseSummary":string,"noticeText":string,"removedDetails":[{"span":string,"reason":string}]}',
  relay: '{"relayText":string,"requiresModeration":boolean}',
};

// Google's own explanation from an error response (never includes resident text).
async function googleMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return String(body?.error?.message ?? res.statusText).slice(0, 300);
  } catch {
    return res.statusText || "no details";
  }
}

// A plain-language next step for the common failures.
function hintFor(status: number): string {
  if (status === 400) return " (check GEMINI_API_KEY in .env)";
  if (status === 403) return " (this key isn't allowed to use this model or API)";
  if (status === 404) return ` (model "${MODEL}" not found; set GEMINI_MODEL in .env)`;
  if (status === 429) return " (usage limit reached; wait a minute and try again)";
  if (status >= 500) return " (Gemini is busy or having a temporary problem)";
  return "";
}

async function ask(system: string, user: string, shape: string): Promise<unknown> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${system}\n\nRespond with JSON only, exactly this shape: ${shape}` }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await googleMessage(res)}${hintFor(res.status)}`);
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  return JSON.parse(text);
}

export const geminiProvider: MediatorProvider = {
  name: `gemini:${MODEL}`,
  draftNotice: (input) => ask(NOTICE_SYSTEM, noticeUserPrompt(input), SHAPES.notice),
  draftRelay: (input) => ask(RELAY_SYSTEM, relayUserPrompt(input), SHAPES.relay),
};
