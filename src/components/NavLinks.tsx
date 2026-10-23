"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Plus, PlusCircle, Siren } from "lucide-react";

const RESIDENT = [
  { href: "/", label: "My concerns", Icon: Home },
  { href: "/cases/new", label: "Report a concern", Icon: PlusCircle },
  { href: "/emergency", label: "Urgent help", Icon: Siren, urgent: true },
];
const MANAGER = [
  { href: "/manager", label: "Review queue", Icon: ClipboardList },
  { href: "/manager#alerts", label: "Urgent alerts", Icon: Siren, urgent: true },
];

function useActive() {
  const path = usePathname();
  return (href: string) =>
    href === "/"
      ? path === "/" || (path.startsWith("/cases/") && path !== "/cases/new")
      : href.includes("#")
        ? false
        : path.startsWith(href);
}

export function NavLinks({ role, layout }: { role: "resident" | "manager"; layout: "side" | "top" }) {
  const active = useActive();
  const items = role === "manager" ? MANAGER : RESIDENT;
  if (layout === "top") {
    return (
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
        {items.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${active(href) ? "bg-white/15 text-white" : "text-white/70 hover:text-white"}`}>
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Main" className="space-y-1.5">
      {items.map(({ href, label, Icon, urgent }) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-semibold transition ${
            active(href)
              ? "bg-white text-navy shadow-lift"
              : urgent
                ? "text-[#ffb4c2] hover:bg-sos/20 hover:text-white"
                : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon size={19} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Phone tab bar: Home, a raised Report button, and SOS (manager: Queue and Alerts). */
export function BottomNav({ role }: { role: "resident" | "manager" }) {
  const active = useActive();
  const tab = (on: boolean) => `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-bold transition ${on ? "text-navy" : "text-ink-faint"}`;

  if (role === "manager") {
    return (
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md px-6">
          <Link href="/manager" aria-current={active("/manager") ? "page" : undefined} className={tab(active("/manager"))}>
            <ClipboardList size={22} aria-hidden="true" /> Queue
          </Link>
          <Link href="/manager#alerts" className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-bold text-sos">
            <Siren size={22} aria-hidden="true" /> Alerts
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/90 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-end px-4">
        <Link href="/" aria-current={active("/") ? "page" : undefined} className={tab(active("/"))}>
          <Home size={22} aria-hidden="true" /> Home
        </Link>
        <Link href="/cases/new" aria-label="Report a concern" className="flex flex-1 flex-col items-center gap-1 pb-2 text-[11px] font-bold text-navy">
          <span className={`-mt-6 flex size-14 items-center justify-center rounded-2xl bg-damai text-white shadow-[0_10px_24px_-8px_rgb(47_111_214_/_0.7)] ring-4 ring-white ${active("/cases/new") ? "scale-105" : ""}`}>
            <Plus size={28} strokeWidth={2.6} aria-hidden="true" />
          </span>
          Report
        </Link>
        <Link
          href="/emergency"
          aria-current={active("/emergency") ? "page" : undefined}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-bold text-sos"
        >
          <Siren size={22} aria-hidden="true" />
          SOS
        </Link>
      </div>
    </nav>
  );
}
