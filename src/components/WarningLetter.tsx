"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileWarning, Loader2, Send } from "lucide-react";
import { post } from "./client";
import { Button, ErrorText } from "./ui";

const PLACEHOLDER = "[community rule]";

/** Manager reviews the auto-drafted warning letter, edits it, and sends it. */
export function WarningLetterForm({ flagId, draftText }: { flagId: string; draftText: string }) {
  const router = useRouter();
  const [text, setText] = useState(draftText);
  const [policyRef, setPolicyRef] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = policyRef.trim() ? text.split(PLACEHOLDER).join(policyRef.trim()) : text;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Send this formal warning letter to the household? It is recorded with your name and reason.")) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/api/reviews/${flagId}/send-warning`, { text, policyRef, rationale });
      router.push("/manager");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl bg-white px-3.5 py-2.5 text-[15px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-coral";
  return (
    <form onSubmit={send} className="space-y-4 rounded-3xl bg-white p-5 shadow-lift ring-2 ring-coral">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-coral-wash text-coral-ink" aria-hidden="true">
          <FileWarning size={20} />
        </span>
        <div>
          <h2 className="text-lg font-bold">Warning letter, ready to review</h2>
          <p className="text-sm text-ink-soft">
            Drafted automatically from the incident record. It says nothing about who reported. Nothing is sent until you press Send.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="letter" className="block text-sm font-semibold">Letter (you can edit it)</label>
        <textarea id="letter" value={text} onChange={(e) => setText(e.target.value)} rows={12} className={`${field} font-[450] leading-relaxed`} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="letterPolicy" className="block text-sm font-semibold">Community rule this warning is issued under</label>
        <input id="letterPolicy" value={policyRef} onChange={(e) => setPolicyRef(e.target.value)} required minLength={3} className={field} placeholder="e.g. Demo Park house rules, s.4 quiet hours" />
        <p className="text-xs text-ink-soft">Replaces {PLACEHOLDER} in the letter.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="letterRationale" className="block text-sm font-semibold">Your reason (kept in the record)</label>
        <textarea id="letterRationale" value={rationale} onChange={(e) => setRationale(e.target.value)} required minLength={10} rows={2} className={field} />
      </div>
      {policyRef.trim() && (
        <details className="rounded-xl bg-paper p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Preview what the household will receive</summary>
          <p className="mt-2 whitespace-pre-wrap">{preview}</p>
        </details>
      )}
      <ErrorText message={error} />
      <Button type="submit" variant="danger" size="lg" disabled={busy} className="w-full">
        {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
        {busy ? "Sending…" : "Send warning letter"}
      </Button>
      <p className="text-center text-xs text-ink-soft">Prefer a different outcome? Use &ldquo;Your decision&rdquo; below; the draft is then discarded.</p>
    </form>
  );
}
