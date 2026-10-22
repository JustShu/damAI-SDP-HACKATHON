import { claudeProvider } from "./claude";
import { geminiProvider } from "./gemini";
import { localProvider } from "./local";
import type { MediatorProvider } from "./types";

// Provider selection. MEDIATOR_PROVIDER = auto (default) | claude | gemini | local.
// "auto" uses Claude if ANTHROPIC_API_KEY is set, else Gemini if GEMINI_API_KEY
// is set, else the built-in engine. Tests can force one with setProvider().
let override: MediatorProvider | null = null;

export function setProvider(p: MediatorProvider | null) {
  override = p;
}

// The provider .env selects (used by `npm run ai:check`).
export const configuredProvider = () => configured();

function configured(): MediatorProvider {
  const choice = (process.env.MEDIATOR_PROVIDER || "auto").toLowerCase();
  if (choice === "claude") return claudeProvider;
  if (choice === "gemini") return geminiProvider;
  if (choice === "local") return localProvider;
  if (process.env.ANTHROPIC_API_KEY) return claudeProvider;
  if (process.env.GEMINI_API_KEY) return geminiProvider;
  return localProvider;
}

// AI calls must never hang a request.
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI timeout")), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Runs the configured provider. If a remote LLM fails or times out, the
// built-in engine takes over so the demo keeps working; the caller learns
// which provider actually produced the text. A forced test provider has no fallback.
export async function runMediator<T>(call: (p: MediatorProvider) => Promise<unknown>, parse: (raw: unknown) => T) {
  const primary = override ?? configured();
  try {
    return { output: parse(await withTimeout(call(primary), 25000)), provider: primary.name, fellBack: false };
  } catch (e) {
    if (override || primary === localProvider) throw e;
    console.error(`Mediator provider ${primary.name} failed; using built-in engine.`, e instanceof Error ? e.message : e);
    return { output: parse(await call(localProvider)), provider: localProvider.name, fellBack: true };
  }
}
