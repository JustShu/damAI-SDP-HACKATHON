import { BadgeCheck, CheckCircle2, Eye, Send, Shield, Siren, XCircle, type LucideIcon } from "lucide-react";
import { fmtDate } from "./ui";

const ICON: Record<string, LucideIcon> = {
  NEW: Send,
  ACKNOWLEDGED: Eye,
  DISPATCHED: Shield,
  ON_SCENE: BadgeCheck,
  POLICE: Siren,
  RESOLVED: CheckCircle2,
  CANCELLED: XCircle,
};

type Update = { id: string; author: string; status: string; body: string; createdAt: Date };

/** Newest update first, the latest one highlighted. */
export function AlertTimeline({ updates }: { updates: Update[] }) {
  const list = [...updates].reverse();
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-6" aria-label="Alert updates">
      {list.map((u, i) => {
        const Icon = ICON[u.status] ?? Send;
        const latest = i === 0;
        return (
          <li key={u.id} className={`arrive relative ${latest ? "" : "opacity-80"}`}>
            <span
              className={`absolute -left-[37px] flex size-8 items-center justify-center rounded-full ring-4 ring-paper ${
                latest ? (u.status === "RESOLVED" ? "bg-teal text-white" : "bg-sos text-white") : "bg-white text-ink-soft ring-line"
              }`}
              aria-hidden="true"
            >
              <Icon size={15} />
            </span>
            <p className={`${latest ? "text-[15px] font-semibold" : "text-sm"}`}>{u.body}</p>
            <p className="text-xs text-ink-faint">
              {u.author === "MANAGER" ? "Community management" : u.author === "REPORTER" ? "You" : "DAMAI"} · {fmtDate(u.createdAt)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
