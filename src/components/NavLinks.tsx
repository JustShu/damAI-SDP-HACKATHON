"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, PlusCircle } from "lucide-react";

const RESIDENT = [
  { href: "/", label: "My concerns", Icon: Home },
  { href: "/cases/new", label: "Report a concern", Icon: PlusCircle },
];
const MANAGER = [{ href: "/manager", label: "Review queue", Icon: ClipboardList }];

export function NavLinks({ role, layout }: { role: "resident" | "manager"; layout: "side" | "top" }) {
  const path = usePathname();
  const items = role === "manager" ? MANAGER : RESIDENT;
  const active = (href: string) => (href === "/" ? path === "/" || (path.startsWith("/cases/") && path !== "/cases/new") : path.startsWith(href));
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
    <nav aria-label="Main" className="space-y-1">
      {items.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors ${active(href) ? "bg-white text-navy" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
