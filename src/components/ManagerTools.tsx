"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock, Eye, FastForward, Loader2, RotateCcw } from "lucide-react";
import { post } from "./client";
import { Button, ErrorText } from "./ui";

// Demo controls: move the clock so 72h / 7-day rules can be shown live.
export function DemoControls({ offsetDays, appTime }: { offsetDays: number; appTime: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function go(label: string, body: object, url = "/api/demo/clock") {
    setBusy(label);
    setError(null);
    try {
      await post(url, body);
      if (url.endsWith("reset")) router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }
  return (
    <section className="rounded-2xl border border-dashed border-line-strong bg-white/60 p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Clock size={17} aria-hidden="true" /> Demo clock
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        App time is {appTime}
        {offsetDays > 0 ? `, ${offsetDays.toFixed(1)} days ahead of real time` : ""}. Moving it forward runs the 72-hour reminder and 7-day review rules.
      </p>
      <ErrorText message={error} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!!busy} onClick={() => go("1d", { advanceHours: 24 })}>
          {busy === "1d" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FastForward size={16} aria-hidden="true" />} Advance 1 day
        </Button>
        <Button variant="secondary" disabled={!!busy} onClick={() => go("3d", { advanceHours: 72 })}>
          <FastForward size={16} aria-hidden="true" /> Advance 3 days
        </Button>
        <Button variant="ghost" disabled={!!busy || offsetDays === 0} onClick={() => go("now", { reset: true })}>
          Back to real time
        </Button>
        <Button variant="ghost" disabled={!!busy} onClick={() => confirm("Reset all demo data? Everyone will be signed out.") && go("reset", {}, "/api/demo/reset")}>
          <RotateCcw size={16} aria-hidden="true" /> Reset demo data
        </Button>
      </div>
    </section>
  );
}

export function RevealPanel({ flagId }: { flagId: string }) {
  const [reason, setReason] = useState("");
  const [data, setData] = useState<{ reporterName: string; reporterHousehold: string; rawReport: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (data) {
    return (
      <section className="arrive space-y-2 rounded-2xl bg-coral-wash p-4 text-sm ring-1 ring-coral">
        <h3 className="font-bold text-coral-ink">Restricted details (your access was logged)</h3>
        <p>
          Raised by <span className="font-semibold">{data.reporterName}</span>, {data.reporterHousehold}
        </p>
        <p className="whitespace-pre-wrap text-ink-soft">&ldquo;{data.rawReport}&rdquo;</p>
      </section>
    );
  }
  return (
    <details className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <Eye size={16} aria-hidden="true" /> Reporter identity and original report are hidden
      </summary>
      <div className="mt-3 space-y-3">
        <label htmlFor="reveal-reason" className="block text-sm text-ink-soft">Only reveal if this review needs it. Your reason is recorded in the audit log.</label>
        <input id="reveal-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-[15px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-teal" placeholder="Reason for access" />
        <ErrorText message={error} />
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              setData(await post(`/api/reviews/${flagId}/reveal`, { reason }));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Reveal and log access
        </Button>
      </div>
    </details>
  );
}

const DECISION_HELP: Record<string, string> = {
  CLOSE_RESOLVED: "The issue has stopped or been sorted out.",
  CLOSE_UNSUBSTANTIATED: "Not enough to support it. The incident stops counting.",
  REQUEST_CONTEXT: "Reopen the conversation and ask both sides for more.",
  MANAGEMENT_ADVISORY: "A reminder of community rules, sent to the household.",
  FORMAL_WARNING: "Only where community rules give you this authority.",
};

export function DecisionForm({ flagId, options }: { flagId: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await post(`/api/reviews/${flagId}/decision`, { decision, rationale: f.get("rationale"), policyRef: f.get("policyRef") });
      router.push("/manager");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  const field = "w-full rounded-xl bg-white px-3.5 py-2.5 text-[15px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-teal";
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-lift ring-2 ring-navy">
      <div>
        <h2 className="text-lg font-bold">Your decision</h2>
        <p className="text-sm text-ink-soft">The AI never decides outcomes. Every decision is logged with your name, reason and the rule applied.</p>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="sr-only">Decision</legend>
        {options.map((o) => (
          <label key={o.value} className={`flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-inset transition-colors ${decision === o.value ? "bg-teal-wash ring-teal" : "ring-line hover:bg-paper"}`}>
            <input type="radio" name="decision" value={o.value} checked={decision === o.value} onChange={() => setDecision(o.value)} required className="mt-0.5 size-4 shrink-0 accent-teal-ink" />
            <span className="text-sm">
              <span className="block font-semibold">{o.label}</span>
              <span className="text-ink-soft">{DECISION_HELP[o.value]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="space-y-1.5">
        <label htmlFor="rationale" className="block text-sm font-semibold">Rationale</label>
        <textarea id="rationale" name="rationale" required minLength={10} rows={3} className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="policyRef" className="block text-sm font-semibold">Rule or policy applied</label>
        <input id="policyRef" name="policyRef" required minLength={3} className={field} placeholder="e.g. Demo Park house rules, section 4" />
      </div>
      <ErrorText message={error} />
      <Button type="submit" variant="dark" size="lg" disabled={busy || !decision} className="w-full">
        {busy ? "Recording…" : "Record decision"}
      </Button>
    </form>
  );
}
