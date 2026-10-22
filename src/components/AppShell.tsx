import Link from "next/link";
import type { ReactNode } from "react";
import type { Actor } from "@/lib/actor";
import { Avatar, LogoMark } from "./brand";
import { NavLinks } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";

const PROTOTYPE_NOTE = "Prototype with fictional residents. Not an official channel of any property company, and not for emergencies.";

export function AppShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const role = actor.managerCommunityIds.length && !actor.household ? "manager" : "resident";
  const subtitle = role === "manager" ? "Community manager" : actor.household?.label ?? "Unverified";
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-navy px-4 py-5 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3 px-2">
          <LogoMark size={36} onDark />
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold tracking-[-0.01em]">Neighbourhood Mediator</span>
            <span className="block text-xs text-white/60">AI prototype</span>
          </span>
        </Link>
        <div className="mt-8 flex-1">
          <NavLinks role={role} layout="side" />
        </div>
        <p className="mb-4 px-2 text-xs leading-relaxed text-white/50">{PROTOTYPE_NOTE}</p>
        <div className="flex items-center gap-3 rounded-xl bg-navy-deep p-3">
          <Avatar name={actor.displayName} size={38} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{actor.displayName}</p>
            <p className="truncate text-xs text-white/60">{subtitle}</p>
          </div>
          <SignOutButton compact />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 bg-navy px-4 pb-2 pt-3 text-white lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={30} onDark />
            <span className="text-[15px] font-extrabold">Neighbourhood Mediator</span>
          </Link>
          <div className="flex items-center gap-1">
            <Avatar name={actor.displayName} size={30} />
            <SignOutButton compact />
          </div>
        </div>
        <div className="mt-2">
          <NavLinks role={role} layout="top" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        {children}
        <p className="mt-16 text-xs text-ink-faint lg:hidden">{PROTOTYPE_NOTE}</p>
      </main>
    </div>
  );
}
