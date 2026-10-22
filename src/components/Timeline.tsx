import { Check } from "lucide-react";

// Case progress (docs/09). A real sequence, so it is drawn as ordered steps.
export function Timeline({ steps }: { steps: { label: string; done: boolean }[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol aria-label="Case progress" className="space-y-0">
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-20px)] w-0.5 ${s.done ? "bg-teal" : "bg-line"}`} aria-hidden="true" />}
          <span
            className={`relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              s.done ? "bg-teal text-white" : i === current ? "bg-white text-ink ring-2 ring-teal" : "bg-white text-ink-faint ring-1 ring-line-strong"
            }`}
          >
            {s.done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : i + 1}
          </span>
          <span className={`pt-0.5 text-sm ${s.done ? "font-semibold" : i === current ? "font-semibold text-ink" : "text-ink-soft"}`}>
            {s.label}
            <span className="sr-only">{s.done ? " (done)" : i === current ? " (current)" : " (not yet)"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
