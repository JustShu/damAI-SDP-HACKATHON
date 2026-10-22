import { POLICY } from "@/lib/domain/constants";
import { fmtDay } from "./ui";

type Incident = { id: string; occurredAt: Date; status: string; reports: number; isThisCase: boolean };

const COUNTS = "QUALIFYING_UNRESOLVED";

// The 3-in-30-days rule made visible: each separate incident is one marker on
// a 30-day line. Filled markers count toward review; hollow ones don't.
export function IncidentTrack({ incidents, now }: { incidents: Incident[]; now: Date }) {
  const span = POLICY.repeatWindowDays * 86_400_000;
  const start = now.getTime() - span;
  const counted = incidents.filter((i) => i.status === COUNTS).length;
  const pos = (d: Date) => Math.min(100, Math.max(0, ((new Date(d).getTime() - start) / span) * 100));

  return (
    <figure className="rounded-2xl bg-white p-5 ring-1 ring-line">
      <figcaption className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold">Last {POLICY.repeatWindowDays} days</span>
        <span className="text-sm text-ink-soft">
          {counted} of {POLICY.repeatThreshold} unresolved incidents needed for review
        </span>
      </figcaption>
      <div className="relative mx-2 h-16">
        <div className="absolute inset-x-0 top-7 h-1 rounded-full bg-line" aria-hidden="true" />
        {incidents.map((i) => {
          const on = i.status === COUNTS;
          return (
            <div key={i.id} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${pos(i.occurredAt)}%` }}>
              <span className={`mx-auto block text-[11px] font-semibold ${i.isThisCase ? "text-ink" : "text-ink-soft"}`}>{i.reports > 1 ? `×${i.reports}` : " "}</span>
              <span
                className={`mx-auto mt-1 block size-5 rounded-full ${on ? "bg-coral-ink" : "bg-white ring-2 ring-inset ring-ink-faint"} ${i.isThisCase ? "ring-4 ring-teal/40" : ""}`}
                title={`${fmtDay(i.occurredAt)}: ${on ? "counts" : "doesn't count"}`}
              />
              <span className="mt-1.5 block whitespace-nowrap text-[11px] text-ink-soft">{fmtDay(i.occurredAt)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-[11px] text-ink-faint" aria-hidden="true">
        <span>{fmtDay(new Date(start))}</span>
        <span>Today</span>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-soft">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-coral-ink" aria-hidden="true" /> Unresolved, counts toward review</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-full ring-2 ring-inset ring-ink-faint" aria-hidden="true" /> Resolved, disputed or in progress</li>
        <li className="flex items-center gap-1.5"><span className="font-semibold">×2</span> several reports of one occurrence, counted once</li>
      </ul>
    </figure>
  );
}
