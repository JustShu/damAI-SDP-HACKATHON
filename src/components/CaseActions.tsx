"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, CircleSlash, Loader2, MessageSquareReply, Scale, Send } from "lucide-react";
import type { RecipientCaseView } from "@/lib/domain/views";
import { MediatorAvatar } from "./brand";
import { post } from "./client";
import { Button, ErrorText } from "./ui";

// Runs a mutation, then re-renders the server components with fresh data.
function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }
  return { busy, error, run };
}

// Reporter: confirm the outcome after the mediator relays a response.
export function ReporterOutcome({ caseId, allowUnresolved }: { caseId: string; allowUnresolved: boolean }) {
  const { busy, error, run } = useAction();
  const confirm = (status: string) => run(() => post(`/api/cases/${caseId}/confirm-status`, { status }));
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">Only you can mark this resolved. A reply on its own isn&apos;t treated as proof either way.</p>
      <ErrorText message={error} />
      <div className="grid gap-2">
        <Button disabled={busy} onClick={() => confirm("RESOLVED")}>
          <CheckCircle2 size={17} aria-hidden="true" /> Yes, it&apos;s sorted
        </Button>
        {allowUnresolved && (
          <Button variant="secondary" disabled={busy} onClick={() => confirm("UNRESOLVED")}>
            <CircleSlash size={17} aria-hidden="true" /> Not resolved yet
          </Button>
        )}
      </div>
    </div>
  );
}

// Either party: ask a person from community management to look at the case.
export function RequestReview({ caseId, who }: { caseId: string; who: "reporter" | "recipient" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction();
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-ink hover:text-ink">
        <Scale size={16} aria-hidden="true" />
        {who === "recipient" ? "Disagree? Ask management for a fair review" : "Ask management to review"}
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-xl bg-paper p-4 ring-1 ring-line">
      <label htmlFor="review-note" className="block font-semibold">Ask management to review</label>
      <p className="text-sm text-ink-soft">A person looks at the case. A review isn&apos;t a penalty and doesn&apos;t take sides.</p>
      <textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Optional: what should the reviewer know?" className="w-full rounded-xl bg-white p-3 text-[15px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-teal" />
      <ErrorText message={error} />
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => run(() => post(`/api/cases/${caseId}/request-review`, { note }))}>Send request</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

const CHOICES = [
  { type: "ACKNOWLEDGE", label: "Acknowledge", hint: "Let them know you've seen it. A note is optional." },
  { type: "COMMIT", label: "Say what you'll do", hint: "Describe what you'll do differently, e.g. \"We'll keep music down after 10pm.\"" },
  { type: "CLARIFY", label: "Explain", hint: "Share context the neighbour may not know, e.g. a one-off event or renovation dates." },
  { type: "DISPUTE", label: "Dispute", hint: "Say what you think is inaccurate. Disputing never counts against you." },
];

// Recipient: choose a response, preview the summary the reporter will get, confirm.
export function RecipientRespond({ view }: { view: RecipientCaseView }) {
  const [choice, setChoice] = useState<string>("COMMIT");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(view.pendingRelay);
  const [summary, setSummary] = useState(view.pendingRelay?.relayText ?? "");
  const { busy, error, run } = useAction();

  const prepare = () =>
    run(async () => {
      const res = await post<{ relayId: string; status: string; relayText: string }>(`/api/cases/${view.id}/respond`, { responseType: choice, text });
      // A held (abusive) reply is never previewed; the refreshed thread explains why.
      if (res.status !== "HELD") {
        setPreview({ id: res.relayId, responseType: choice, relayText: res.relayText });
        setSummary(res.relayText);
      }
    });

  if (preview) {
    return (
      <section className="arrive space-y-4 rounded-2xl bg-white p-5 shadow-lift ring-2 ring-teal" aria-labelledby="preview-title">
        <div className="flex gap-3">
          <MediatorAvatar size={34} />
          <div>
            <h2 id="preview-title" className="font-bold">Here&apos;s what I&apos;ll tell your neighbour</h2>
            <p className="text-sm text-ink-soft">I share this summary, not your exact words. Edit it if anything is too personal.</p>
          </div>
        </div>
        <textarea aria-label="Summary to share" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="w-full rounded-xl bg-teal-wash/50 p-3.5 text-[15px] leading-relaxed ring-1 ring-inset ring-teal/40 focus:outline-none focus:ring-2 focus:ring-teal" />
        <ErrorText message={error} />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await post(`/api/cases/${view.id}/confirm-relay`, { relayId: preview.id, relayText: summary });
                setPreview(null);
                setText("");
              })
            }
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />} Share this summary
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setPreview(null)}>
            Change my reply
          </Button>
        </div>
      </section>
    );
  }

  const selected = CHOICES.find((c) => c.type === choice)!;
  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-line" aria-labelledby="reply-title">
      <h2 id="reply-title" className="flex items-center gap-2 font-bold">
        <MessageSquareReply size={18} aria-hidden="true" className="text-teal-ink" /> Reply privately to the mediator
      </h2>
      <div role="radiogroup" aria-label="Type of reply" className="flex flex-wrap gap-2">
        {CHOICES.map((c) => (
          <button
            key={c.type}
            role="radio"
            aria-checked={choice === c.type}
            onClick={() => setChoice(c.type)}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors ${choice === c.type ? "bg-navy text-white ring-navy" : "bg-white text-ink ring-line-strong hover:ring-ink/40"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <label htmlFor="reply" className="block text-sm text-ink-soft">{selected.hint}</label>
      <textarea id="reply" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} placeholder="Write your reply…" className="w-full rounded-xl p-3.5 text-[15px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-teal" />
      <ErrorText message={error} />
      <Button disabled={busy || (choice !== "ACKNOWLEDGE" && text.trim().length < 3)} onClick={prepare}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
        {busy ? "The mediator is summarising…" : "Preview what will be shared"}
      </Button>
    </section>
  );
}
