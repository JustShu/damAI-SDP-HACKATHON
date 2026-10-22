"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Car, CircleEllipsis, Loader2, PawPrint, ShieldAlert, Volume2 } from "lucide-react";
import { TOPIC_MAX, TOPIC_MIN } from "@/lib/domain/constants";
import { post } from "./client";
import { Button, ErrorText } from "./ui";

const CATEGORIES = [
  { value: "NOISE", label: "Noise", hint: "Music, voices, renovation, engines", Icon: Volume2 },
  { value: "PARKING", label: "Parking", hint: "Blocked gates, double-parking, walkways", Icon: Car },
  { value: "PET", label: "Pet", hint: "Barking, roaming, waste", Icon: PawPrint },
  { value: "OTHER", label: "Other", hint: "Rubbish, smoke, leaks, trees, damage…", Icon: CircleEllipsis },
];

function localNow() {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

export function NewConcernForm({ households }: { households: { id: string; label: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("PARKING");
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  // Computed on the client only, so server and browser render the same markup.
  const [maxTime] = useState(() => (typeof window === "undefined" ? undefined : localNow()));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ id: string }>("/api/cases", {
        targetHouseholdId: f.get("target"),
        category,
        occurredAt: new Date(String(f.get("occurredAt"))).toISOString(),
        description: text,
        safetyConcern: f.get("safety") === "on",
        ...(category === "OTHER" ? { topic } : {}),
      });
      router.push(`/cases/${res.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl bg-white px-3.5 py-3 text-[15px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-teal";
  return (
    <form onSubmit={submit} className="space-y-7">
      <fieldset className="space-y-2.5">
        <legend className="mb-2.5 font-bold">What is it about?</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {CATEGORIES.map(({ value, label, hint, Icon }) => {
            const on = category === value;
            return (
              <label
                key={value}
                className={`relative flex cursor-pointer flex-col gap-2 rounded-2xl p-4 ring-1 ring-inset transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal ${on ? "bg-navy text-white ring-navy" : "bg-white ring-line-strong hover:ring-ink/40"}`}
              >
                <input type="radio" name="category" value={value} checked={on} onChange={() => setCategory(value)} className="sr-only" />
                <Icon size={22} aria-hidden="true" className={on ? "text-teal" : "text-ink-soft"} />
                <span className="font-semibold">{label}</span>
                <span className={`text-xs ${on ? "text-white/70" : "text-ink-soft"}`}>{hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {category === "OTHER" && (
        <div className="space-y-2">
          <label htmlFor="topic" className="block font-bold">In a few words, what is it?</label>
          <p id="topic-hint" className="text-sm text-ink-soft">
            A short, neutral subject such as &ldquo;Rubbish left outside&rdquo; or &ldquo;Water dripping from aircon&rdquo;. It may appear in the notice.
          </p>
          <input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            minLength={TOPIC_MIN}
            maxLength={TOPIC_MAX}
            aria-describedby="topic-hint"
            className={field}
          />
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="target" className="block font-bold">Which home?</label>
          <select id="target" name="target" required className={field} defaultValue="">
            <option value="" disabled>Choose a home in Demo Park</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>{h.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="occurredAt" className="block font-bold">When did it happen?</label>
          <input id="occurredAt" name="occurredAt" type="datetime-local" required defaultValue={maxTime} max={maxTime} className={field} suppressHydrationWarning />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <label htmlFor="description" className="block font-bold">What happened?</label>
          <span className="text-xs text-ink-faint" aria-live="polite">{text.length}/2000</span>
        </div>
        <p id="description-hint" className="text-sm text-ink-soft">
          Write it in your own words. Mention what you noticed, roughly when, and how it affected you. Only you see this.
        </p>
        <textarea
          id="description"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          aria-describedby="description-hint"
          placeholder="e.g. A car was parked across the entrance to my driveway from about 8pm, so I couldn't get my car out."
          className={`${field} resize-y leading-relaxed`}
        />
      </div>

      <label className="flex cursor-pointer gap-3.5 rounded-2xl bg-coral-wash p-4 ring-1 ring-inset ring-coral/60">
        <input type="checkbox" name="safety" className="mt-1 size-5 shrink-0 accent-coral-ink" />
        <span className="text-sm text-coral-ink">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold">
            <ShieldAlert size={17} aria-hidden="true" /> Someone has been threatened, hurt, or may be in danger
          </span>
          This skips mediation and goes straight to community management. This app isn&apos;t monitored in real time. In an emergency, call 999.
        </span>
      </label>

      <ErrorText message={error} />
      <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
        {busy ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden="true" /> The mediator is reading your report…
          </>
        ) : (
          "Send to the mediator"
        )}
      </Button>
    </form>
  );
}
