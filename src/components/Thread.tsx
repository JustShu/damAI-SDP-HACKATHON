import { Landmark } from "lucide-react";
import { MediatorAvatar } from "./brand";
import { fmtDate } from "./ui";

type Msg = { id: string; author: string; kind: string; body: string; createdAt: Date };

// One private stream. Each party only ever sees their own side; there is no
// direct message between residents anywhere in the app.
export function Thread({ messages, title, youLabel = "You" }: { messages: Msg[]; title: string; youLabel?: string }) {
  return (
    <section aria-label={title} className="rounded-2xl bg-white ring-1 ring-line">
      <h2 className="border-b border-line px-5 py-3.5 font-bold">{title}</h2>
      <ol className="space-y-4 px-4 py-5 sm:px-5">
        {messages.length === 0 && <li className="text-sm text-ink-soft">Nothing here yet.</li>}
        {messages.map((m) => {
          const time = <time className="text-xs text-ink-faint">{fmtDate(m.createdAt)}</time>;
          if (m.kind === "MANAGEMENT") {
            return (
              <li key={m.id} className="rounded-2xl bg-navy p-4 text-white">
                <p className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-white/80">
                    <Landmark size={14} aria-hidden="true" /> Community management (a person)
                  </span>
                  <time className="text-white/60">{fmtDate(m.createdAt)}</time>
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            );
          }
          if (m.author === "SYSTEM") {
            return (
              <li key={m.id} className="flex flex-col items-center gap-1 text-center">
                <p className="max-w-[90%] rounded-full bg-paper px-4 py-1.5 text-sm text-ink-soft ring-1 ring-line">{m.body}</p>
                {time}
              </li>
            );
          }
          if (m.author === "RESIDENT") {
            return (
              <li key={m.id} className="flex flex-col items-end gap-1">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-navy px-4 py-3 text-white">
                  <p className="whitespace-pre-wrap text-[15px]">{m.body}</p>
                </div>
                <span className="text-xs text-ink-faint">
                  {youLabel}, {fmtDate(m.createdAt)}
                </span>
              </li>
            );
          }
          return (
            <li key={m.id} className="flex gap-3">
              <MediatorAvatar size={34} />
              <div className="min-w-0 max-w-[85%] space-y-1">
                <div className={`rounded-2xl rounded-tl-md px-4 py-3 ${m.kind === "REMINDER" ? "bg-[#fff6e0] ring-1 ring-[#f0d28a]" : "bg-teal-wash"}`}>
                  <p className="mb-0.5 text-xs font-semibold text-teal-ink">
                    {m.kind === "RELAY" ? "Mediator: their reply" : m.kind === "REMINDER" ? "Mediator: friendly reminder" : "AI Community Mediator"}
                  </p>
                  <p className="whitespace-pre-wrap text-[15px]">{m.body}</p>
                </div>
                {time}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
