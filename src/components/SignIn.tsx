import { ArrowDown, EyeOff, ShieldCheck, Siren, UserCheck } from "lucide-react";
import { LogoMark, MediatorAvatar, Wordmark } from "./brand";
import { LoginList } from "./LoginList";

type Account = Parameters<typeof LoginList>[0]["accounts"];

// Signed-out landing: what DAMAI does, and the demo account picker.
export function SignIn({ accounts }: { accounts: Account }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="bg-damai-night relative overflow-hidden px-6 pb-12 pt-[calc(2.5rem+env(safe-area-inset-top))] text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        {/* soft glowing orbs */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#12b5a6]/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-[#5b4cf0]/35 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <LogoMark size={48} onDark />
          <Wordmark onDark size="lg" />
        </div>

        <div className="relative mt-10 max-w-xl lg:mt-0">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/85 ring-1 ring-white/15">
            Jiran aman, hidup damai
          </p>
          <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">
            Sort out neighbour issues <span className="bg-gradient-to-r from-[#8fe8dd] to-[#b8b0ff] bg-clip-text text-transparent">without the awkward knock.</span>
          </h1>
          <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-white/75">
            Tell DAMAI&apos;s AI mediator what happened. It writes a calm, neutral notice, shows you exactly what your neighbour will see, and sends
            nothing until you approve. Something urgent happening right now? One tap alerts community management.
          </p>
          <a href="#sign-in" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 font-bold text-navy shadow-lift transition active:scale-[0.98] lg:hidden">
            Get started <ArrowDown size={18} aria-hidden="true" />
          </a>

          {/* The two private channels, drawn as they work. */}
          <div className="mt-8 rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/15 backdrop-blur" aria-label="How messages flow">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center text-sm">
              <div className="rounded-2xl bg-white/10 px-3 py-3 ring-1 ring-white/10">
                <p className="font-semibold">You</p>
                <p className="text-xs text-white/60">private chat</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <MediatorAvatar size={48} />
                <p className="text-xs font-semibold text-[#8fe8dd]">AI mediator</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-3 ring-1 ring-white/10">
                <p className="font-semibold">Neighbour</p>
                <p className="text-xs text-white/60">private chat</p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-white/60">No direct messages between residents. Only what you approve is passed on.</p>
          </div>
        </div>

        <ul className="relative mt-10 grid gap-3 text-sm text-white/85 sm:grid-cols-2 lg:mt-0">
          {[
            { Icon: EyeOff, text: "Your identity is hidden from the other household" },
            { Icon: UserCheck, text: "One verified account per resident, linked to their home" },
            { Icon: ShieldCheck, text: "Only a person in management decides outcomes" },
            { Icon: Siren, text: "Urgent alerts go straight to management and security" },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#8fe8dd]">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="pt-1">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="sign-in" className="scroll-mt-4 px-6 py-10 sm:px-10 lg:overflow-y-auto lg:px-14 lg:py-14">
        <div className="mx-auto max-w-md">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em]">
            Welcome to <span className="text-damai">DAMAI</span>
          </h2>
          <p className="mt-2 text-ink-soft">
            Choose a demo account. Everyone here is fictional and already verified. A real deployment would use each resident&apos;s own sign-in.
          </p>
          <div className="mt-6">
            <LoginList accounts={accounts} />
          </div>
          <p className="mt-8 text-xs text-ink-faint">
            Prototype. Not an official channel of any property company. If anyone is in danger, call 999 first.
          </p>
        </div>
      </section>
    </div>
  );
}
