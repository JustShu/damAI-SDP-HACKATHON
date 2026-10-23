"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, Eye, Loader2, MapPin, Shield, ShieldAlert, Siren, Swords, UserRoundX, HeartPulse } from "lucide-react";
import { post } from "./client";
import { Button, ErrorText } from "./ui";

const TYPES = [
  { value: "FIGHT", label: "Fight or violence", Icon: Swords },
  { value: "INJURY", label: "Someone is hurt", Icon: HeartPulse },
  { value: "INTRUDER", label: "Intruder or suspicious", Icon: UserRoundX },
  { value: "OTHER", label: "Other urgent", Icon: ShieldAlert },
];

/** Re-fetches the page every few seconds so new updates appear on their own. */
export function LiveRefresh({ seconds = 5, active = true }: { seconds?: number; active?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, active]);
  return null;
}

export function EmergencyForm() {
  const router = useRouter();
  const [type, setType] = useState("FIGHT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ id: string }>("/api/emergency", { type, location: f.get("location"), details: f.get("details") });
      router.push(`/emergency/${res.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const field = "w-full rounded-2xl bg-white px-4 py-3.5 text-[16px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-sos";
  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="mb-2.5 font-bold">What&apos;s happening?</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {TYPES.map(({ value, label, Icon }) => {
            const on = type === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer flex-col gap-2 rounded-2xl p-4 ring-1 ring-inset transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sos ${
                  on ? "bg-sos text-white ring-sos shadow-lift" : "bg-white ring-line-strong hover:ring-sos/50"
                }`}
              >
                <input type="radio" name="type" value={value} checked={on} onChange={() => setType(value)} className="sr-only" />
                <Icon size={24} aria-hidden="true" className={on ? "text-white" : "text-sos"} />
                <span className="font-semibold leading-tight">{label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="location" className="flex items-center gap-1.5 font-bold">
          <MapPin size={17} aria-hidden="true" /> Where exactly?
        </label>
        <input id="location" name="location" required minLength={3} maxLength={200} className={field} placeholder="e.g. Playground near Jalan Damai 3" />
      </div>

      <div className="space-y-2">
        <label htmlFor="details" className="block font-bold">
          Anything security should know? <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <textarea id="details" name="details" maxLength={1000} rows={3} className={`${field} resize-y`} placeholder="How many people, anyone hurt, weapons seen…" />
      </div>

      <ErrorText message={error} />
      <Button type="submit" variant="danger" size="lg" disabled={busy} className="min-h-14 w-full rounded-2xl text-base">
        {busy ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Siren size={20} aria-hidden="true" />}
        {busy ? "Alerting management…" : "Alert management now"}
      </Button>
      <p className="text-center text-xs text-ink-soft">Management will see your name and house so security can reach you.</p>
    </form>
  );
}

export function CancelAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <ErrorText message={error} />
      <Button
        variant="secondary"
        disabled={busy}
        className="w-full"
        onClick={async () => {
          if (!confirm("Cancel this alert? Only do this if help is no longer needed.")) return;
          setBusy(true);
          try {
            await post(`/api/emergency/${alertId}/cancel`);
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          }
          setBusy(false);
        }}
      >
        It was a false alarm, cancel
      </Button>
    </div>
  );
}

const ACTIONS = [
  { action: "ACKNOWLEDGE", label: "Seen, responding", Icon: Eye },
  { action: "DISPATCH", label: "Dispatch security", Icon: Shield },
  { action: "ON_SCENE", label: "Security on scene", Icon: BadgeCheck },
  { action: "POLICE", label: "Police contacted", Icon: Siren },
  { action: "RESOLVE", label: "Mark resolved", Icon: CheckCircle2 },
] as const;

/** Manager's response panel: each action notifies the reporter. */
export function AlertActions({ alertId, status }: { alertId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [eta, setEta] = useState("5");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: string) {
    setBusy(action);
    setError(null);
    try {
      await post(`/api/emergency/${alertId}/action`, {
        action,
        ...(action === "DISPATCH" && Number(eta) > 0 ? { etaMinutes: Number(eta) } : {}),
        ...(note.trim() ? { note } : {}),
      });
      setNote("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  const field = "w-full rounded-xl bg-white px-3.5 py-2.5 text-[15px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-sos";
  return (
    <section className="space-y-4 rounded-3xl bg-white p-5 shadow-lift ring-2 ring-sos/50">
      <div>
        <h2 className="text-lg font-bold">Respond</h2>
        <p className="text-sm text-ink-soft">Each step is sent to the resident straight away.</p>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor="eta" className="block text-sm font-semibold">Security ETA (minutes)</label>
          <input id="eta" type="number" min={1} max={120} value={eta} onChange={(e) => setEta(e.target.value)} className={field} />
        </div>
        <Button variant="danger" size="lg" disabled={!!busy || status === "DISPATCHED"} onClick={() => act("DISPATCH")}>
          {busy === "DISPATCH" ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Shield size={18} aria-hidden="true" />} Dispatch security
        </Button>
      </div>
      <div className="space-y-1">
        <label htmlFor="note" className="block text-sm font-semibold">Note to the resident <span className="font-normal text-ink-soft">(optional)</span></label>
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={field} placeholder="e.g. Guard Ahmad is coming from the main gate" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.filter((a) => a.action !== "DISPATCH").map(({ action, label, Icon }) => (
          <Button key={action} variant={action === "RESOLVE" ? "dark" : "secondary"} disabled={!!busy || status === ACTION_STATUS[action]} onClick={() => act(action)}>
            {busy === action ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />} {label}
          </Button>
        ))}
      </div>
      <ErrorText message={error} />
    </section>
  );
}

const ACTION_STATUS: Record<string, string> = { ACKNOWLEDGE: "ACKNOWLEDGED", ON_SCENE: "ON_SCENE", POLICE: "POLICE", RESOLVE: "RESOLVED" };
