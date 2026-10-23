"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowRight, Check, Loader2, Pencil, RefreshCw, Send, TriangleAlert, X } from "lucide-react";
import type { ReporterCaseView } from "@/lib/domain/views";
import { MediatorAvatar } from "./brand";
import { post } from "./client";
import { Button, ErrorText } from "./ui";

type Span = { span: string; reason: string };

// Split text into plain and marked segments for the given spans (case-insensitive).
function segments(text: string, spans: Span[]) {
  const live = spans.filter((s) => s.span.trim());
  if (!live.length) return [{ text, mark: null as Span | null }];
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Whole-word boundaries where the span starts/ends with a word character.
  const wrap = (t: string) => `${/^\w/.test(t) ? "\\b" : ""}${esc(t)}${/\w$/.test(t) ? "\\b" : ""}`;
  const re = new RegExp(`(${live.map((s) => wrap(s.span)).join("|")})`, "gi");
  return text
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, mark: live.find((s) => s.span.toLowerCase() === part.toLowerCase()) ?? null }));
}

const TONES = [
  { value: "FRIENDLY", label: "Friendly" },
  { value: "FORMAL", label: "Formal" },
  { value: "BRIEF", label: "Brief" },
];

function providerLabel(p: string) {
  if (p.startsWith("claude")) return "Written by Claude";
  if (p.startsWith("gemini")) return "Written by Gemini";
  if (p === "edited by you") return "Edited by you";
  return "Written by the built-in mediator";
}

export function MediatorSays({ children, label = "AI Community Mediator" }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="arrive flex gap-3">
      <MediatorAvatar size={38} />
      <div className="min-w-0 rounded-2xl rounded-tl-md bg-white px-4 py-3 ring-1 ring-teal/40">
        <p className="text-xs font-semibold text-teal-ink">{label}</p>
        <div className="mt-0.5 text-[15px]">{children}</div>
      </div>
    </div>
  );
}

// Shown when the mediator needs more detail, or declined the report.
export function ClarifyPanel({ view }: { view: ReporterCaseView }) {
  const router = useRouter();
  const [text, setText] = useState(view.rawText);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  return (
    <div className="max-w-2xl space-y-5">
      <MediatorSays>{view.mediatorQuestion ?? "We couldn't prepare a safe message. Your report is saved as a draft and hasn't been sent."}</MediatorSays>
      <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
        <label htmlFor="redo" className="block font-bold">Your report (private)</label>
        <p className="text-sm text-ink-soft">Add what the mediator asked for. Only you can see this.</p>
        <textarea id="redo" value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={2000} className="w-full rounded-xl px-3.5 py-3 text-[15px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-teal" />
        <ErrorText message={error} />
        <div className="flex flex-wrap gap-2.5 pt-1">
          <Button disabled={!!busy || text.trim().length < 10} onClick={() => run("send", () => post(`/api/cases/${view.id}/update-description`, { description: text }))}>
            {busy === "send" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            Send to the mediator
          </Button>
          <Button variant="ghost" disabled={!!busy} onClick={() => run("cancel", () => post(`/api/cases/${view.id}/cancel`))}>
            Cancel this report
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DraftReview({ view }: { view: ReporterCaseView }) {
  const router = useRouter();
  const draft = view.draft!;
  const [mode, setMode] = useState<"review" | "edit">("review");
  const [text, setText] = useState(draft.text);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  const blockers = draft.findings.filter((f) => f.severity === "BLOCK");
  const warnings = draft.findings.filter((f) => f.severity === "WARN");
  const regenerate = (tone?: string) => run(tone ? `tone-${tone}` : "regen", () => post(`/api/cases/${view.id}/draft-notice`, { tone }));

  async function approveAndSend() {
    // Approve the exact version + hash shown, then send with a fresh idempotency key.
    await post(`/api/cases/${view.id}/approve-notice`, { draftId: draft.id, textHash: draft.textHash, acknowledgeInferenceRisk: ack });
    await post(`/api/cases/${view.id}/send-notice`, { draftId: draft.id, idempotencyKey: crypto.randomUUID() });
  }

  return (
    <div className="space-y-6 pb-28">
      {draft.note && <MediatorSays>{draft.note}</MediatorSays>}

      {/* Tone and regenerate */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Tone" className="inline-flex rounded-xl bg-white p-1 ring-1 ring-line">
          {TONES.map((t) => {
            const on = draft.tone === t.value;
            return (
              <button
                key={t.value}
                role="radio"
                aria-checked={on}
                disabled={!!busy || mode === "edit"}
                onClick={() => !on && regenerate(t.value)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors ${on ? "bg-navy text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {busy === `tone-${t.value}` && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {t.label}
              </button>
            );
          })}
        </div>
        <Button variant="secondary" disabled={!!busy || mode === "edit"} onClick={() => regenerate()}>
          <RefreshCw size={16} className={busy === "regen" ? "animate-spin" : ""} aria-hidden="true" />
          {busy === "regen" ? "Writing a new version…" : "Try another wording"}
        </Button>
      </div>

      {/* Your words → mediator → what they see */}
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)]">
        <section aria-labelledby="yours" className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 id="yours" className="font-bold">Your words</h2>
          <p className="mb-3 text-xs text-ink-soft">Private. Never shown to {view.targetLabel}.</p>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            {segments(view.rawText, draft.removed).map((s, i) =>
              s.mark ? (
                <span key={i} className="struck text-coral-ink" style={{ ["--d" as string]: `${250 + i * 80}ms` }} title={s.mark.reason}>
                  {s.text}
                </span>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </p>
        </section>

        <div className="flex items-center justify-center text-teal" aria-hidden="true">
          <ArrowRight size={22} className="hidden lg:block" />
          <ArrowDown size={22} className="lg:hidden" />
        </div>

        <section aria-labelledby="theirs" className="overflow-hidden rounded-2xl bg-white shadow-lift ring-2 ring-teal">
          <div className="flex items-center gap-3 border-b border-line bg-teal-wash px-5 py-3">
            <MediatorAvatar size={30} />
            <div className="min-w-0 flex-1 leading-tight">
              <h2 id="theirs" className="font-bold">What {view.targetLabel} will see</h2>
              <p className="text-xs text-teal-ink">
                From the AI Community Mediator. Version {draft.version}, {providerLabel(draft.provider).toLowerCase()}
              </p>
            </div>
          </div>
          <div key={draft.id} className="arrive p-5">
            {mode === "review" ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {segments(draft.text, draft.findings).map((s, i) =>
                  s.mark ? (
                    <mark key={i} className="rounded bg-coral px-0.5 text-ink" title={s.mark.reason}>
                      {s.text}
                    </mark>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </p>
            ) : (
              <div className="space-y-3">
                <textarea aria-label="Edit the notice" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="w-full rounded-xl p-3 text-[15px] leading-relaxed ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-teal" />
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!!busy} onClick={() => run("save", async () => { await post(`/api/cases/${view.id}/edit-notice`, { text }); setMode("review"); })}>
                    <Check size={16} aria-hidden="true" /> {busy === "save" ? "Checking…" : "Save and re-check"}
                  </Button>
                  <Button variant="ghost" disabled={!!busy} onClick={() => { setText(draft.text); setMode("review"); }}>
                    Discard changes
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Privacy check */}
      <section aria-labelledby="check" className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <h2 id="check" className="mb-3 font-bold">Privacy check</h2>
        <ul className="space-y-2.5 text-sm">
          <CheckItem ok={blockers.length === 0}>
            {blockers.length === 0 ? "Your name and household aren't in the notice" : "The notice contains details that identify you. Remove them before sending."}
          </CheckItem>
          {draft.removed.length > 0 && (
            <CheckItem ok>
              Left out {draft.removed.length} detail{draft.removed.length === 1 ? "" : "s"}:{" "}
              {draft.removed.map((r, i) => (
                <span key={i}>
                  <span className="font-semibold line-through decoration-coral-ink decoration-2">{r.span}</span>
                  <span className="text-ink-soft"> ({r.reason.toLowerCase()})</span>
                  {i < draft.removed.length - 1 ? ", " : ""}
                </span>
              ))}
            </CheckItem>
          )}
          {[...blockers, ...warnings].map((f, i) => (
            <CheckItem key={i} ok={false}>
              <mark className="rounded bg-coral px-1 text-ink">{f.span}</mark> {f.reason}
              {f.severity === "BLOCK" ? ". Remove this before sending." : ". Make sure you're comfortable sharing it."}
            </CheckItem>
          ))}
        </ul>
      </section>

      <label className="flex cursor-pointer gap-3.5 rounded-2xl bg-white p-5 text-[15px] ring-1 ring-line has-[:checked]:ring-2 has-[:checked]:ring-teal">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 size-5 shrink-0 accent-teal-ink" />
        <span>
          I&apos;ve read exactly what will be sent. I understand my identity is hidden by default, but {view.targetLabel} may still guess
          who reported from the circumstances. Community management can see who raised a concern if a review needs it.
        </span>
      </label>

      <ErrorText message={error} />

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-[272px]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2.5 lg:px-6">
          <Button size="lg" disabled={!ack || blockers.length > 0 || !!busy || mode === "edit"} onClick={() => run("send", approveAndSend)}>
            {busy === "send" ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
            Approve and send
          </Button>
          <Button variant="secondary" size="lg" disabled={!!busy || mode === "edit"} onClick={() => setMode("edit")}>
            <Pencil size={16} aria-hidden="true" /> Edit
          </Button>
          <Button variant="ghost" size="lg" disabled={!!busy} onClick={() => run("cancel", () => post(`/api/cases/${view.id}/cancel`))} className="ml-auto">
            <X size={16} aria-hidden="true" /> Cancel report
          </Button>
          {!ack && <p className="w-full text-xs text-ink-soft sm:w-auto">Tick the confirmation above to send.</p>}
        </div>
      </div>
    </div>
  );
}

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      {ok ? (
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal text-white" aria-label="OK">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : (
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-coral text-coral-ink" aria-label="Check">
          <TriangleAlert size={12} strokeWidth={2.6} />
        </span>
      )}
      <span>{children}</span>
    </li>
  );
}
