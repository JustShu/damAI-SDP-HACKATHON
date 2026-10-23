import Link from "next/link";
import type { ReactNode } from "react";
import type { Actor } from "@/lib/actor";
import { Avatar, LogoMark, Wordmark } from "./brand";
import { BottomNav, NavLinks } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";

const PROTOTYPE_NOTE = "DAMAI prototype with fictional residents. Not an official channel of any property company. In an emergency, call 999.";

export function AppShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const role = actor.managerCommunityIds.length && !actor.household ? "manager" : "resident";
  const subtitle = role === "manager" ? "Community manager" : actor.household?.label ?? "Unverified";
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      {/* Desktop sidebar */}
      <aside className="bg-damai-night sticky top-0 hidden h-dvh flex-col px-4 py-6 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3 px-2">
          <LogoMark size={40} onDark />
          <Wordmark onDark />
        </Link>
        <div className="mt-10 flex-1">
          <NavLinks role={role} layout="side" />
        </div>
        <p className="mb-4 px-2 text-xs leading-relaxed text-white/45">{PROTOTYPE_NOTE}</p>
        <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur">
          <Avatar name={actor.displayName} size={38} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{actor.displayName}</p>
            <p className="truncate text-xs text-white/60">{subtitle}</p>
          </div>
          <SignOutButton compact />
        </div>
      </aside>

      {/* Phone top bar: brand and account only; navigation lives in the bottom tab bar. */}
      <header className="bg-damai-night sticky top-0 z-20 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white shadow-[0_8px_24px_-12px_rgb(23_18_63_/_0.6)] lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={34} onDark />
            <Wordmark onDark tagline={false} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-right text-xs leading-tight text-white/70 min-[380px]:block">
              <span className="block font-semibold text-white">{actor.displayName.split(" ")[0]}</span>
              {subtitle}
            </span>
            <Avatar name={actor.displayName} size={32} />
            <SignOutButton compact />
          </div>
        </div>
      </header>

      <main className="pb-tabbar mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-10 lg:pb-20 lg:pt-10">
        {children}
        <p className="mt-16 text-xs text-ink-faint lg:hidden">{PROTOTYPE_NOTE}</p>
      </main>

      <BottomNav role={role} />
    </div>
  );
}
