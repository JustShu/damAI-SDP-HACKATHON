// Checks that the AI provider selected in .env works.
// Run with:  npm run ai:check
// Sends ONE made-up sample report (no real resident data) straight to the
// configured provider, without the built-in fallback, and prints the result
// or the exact reason it failed.

import { configuredProvider } from "../src/lib/mediator";
import { NoticeOutputSchema } from "../src/lib/mediator/types";

async function main() {
  const choice = (process.env.MEDIATOR_PROVIDER || "auto").toLowerCase();
  const provider = configuredProvider();
  console.log(`MEDIATOR_PROVIDER = "${choice}"  →  using: ${provider.name}`);
  console.log(`GEMINI_API_KEY    = ${process.env.GEMINI_API_KEY ? "set" : "not set"}`);
  console.log(`ANTHROPIC_API_KEY = ${process.env.ANTHROPIC_API_KEY ? "set" : "not set"}`);

  if (provider.name.startsWith("built-in")) {
    console.log("\nNo AI key is in use, so the built-in (rule-based) mediator writes the notices.");
    console.log('To use Gemini, set GEMINI_API_KEY="your-key" in .env (and MEDIATOR_PROVIDER="gemini" or "auto").');
    return;
  }

  console.log("\nAsking the AI to write a sample notice...");
  const started = Date.now();
  try {
    const out = NoticeOutputSchema.parse(
      await provider.draftNotice({
        category: "OTHER",
        topic: "Rubbish left outside",
        occurredAt: new Date(),
        rawText: "Bags of rubbish keep getting left outside the gate next to mine for days. It smells and attracts rats.",
        tone: "FRIENDLY",
        attempt: 1,
      }),
    );
    console.log(`\n✓ The AI works (${provider.name}, ${((Date.now() - started) / 1000).toFixed(1)}s). Outcome: ${out.outcome}\n`);
    console.log(`  ${out.noticeText || out.mediatorMessage}\n`);
    console.log("(The app still privacy-checks every AI notice before the reporter sees it.)");
  } catch (e) {
    console.log(`\n✗ The AI call failed (${provider.name}):\n  ${e instanceof Error ? e.message : String(e)}`);
    console.log("\nIn the app, the built-in mediator takes over when this happens, so reports still get a notice.");
    process.exitCode = 1;
  }
}

main();
