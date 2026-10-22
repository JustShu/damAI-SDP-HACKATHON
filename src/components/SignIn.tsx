import { EyeOff, ShieldCheck, UserCheck } from "lucide-react";
import { LogoMark, MediatorAvatar } from "./brand";
import { LoginList } from "./LoginList";

type Account = Parameters<typeof LoginList>[0]["accounts"];

// Signed-out landing: what the product does, and the demo account picker.
export function SignIn({ accounts }: { accounts: Account }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="relative overflow-hidden bg-navy px-6 py-10 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="flex items-center gap-3">
          <LogoMark size={40} onDark />
          <div className="leading-tight">
            <p className="text-lg font-extrabold">Neighbourhood Mediator</p>
            <p className="text-sm text-white/60">AI prototype for Demo Park Residences</p>
          </div>
        </div>

        <div className="mt-12 max-w-xl lg:mt-0">
          <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-[-0.025em] sm:text-[44px]">
            Raise a neighbour issue without the awkward knock on the door.
          </h1>
          <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-white/75">
            Tell the AI mediator what happened. It writes a calm, neutral notice, shows you exactly what your neighbour will see, and
            sends nothing until you approve.
          </p>

          {/* The two private channels, drawn as they work. */}
          <div className="mt-10 rounded-2xl bg-navy-deep p-5 ring-1 ring-navy-line" aria-label="How messages flow">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center text-sm">
              <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
                <p className="font-semibold">You</p>
                <p className="text-xs text-white/60">private chat</p>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <MediatorAvatar size={44} />
                <p className="text-xs font-semibold text-teal">Mediator</p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
                <p className="font-semibold">Neighbour</p>
                <p className="text-xs text-white/60">private chat</p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-white/60">No direct messages between residents. Only what you approve is passed on.</p>
          </div>
        </div>

        <ul className="mt-10 grid gap-3 text-sm text-white/80 sm:grid-cols-3 lg:mt-0">
          <li className="flex gap-2.5">
            <EyeOff size={18} className="shrink-0 text-teal" aria-hidden="true" />
            Your identity is hidden from the other household by default
          </li>
          <li className="flex gap-2.5">
            <UserCheck size={18} className="shrink-0 text-teal" aria-hidden="true" />
            One verified account per resident, linked to their home
          </li>
          <li className="flex gap-2.5">
            <ShieldCheck size={18} className="shrink-0 text-teal" aria-hidden="true" />
            Only a person in management can decide outcomes
          </li>
        </ul>
      </section>

      <section className="px-6 py-10 sm:px-10 lg:overflow-y-auto lg:px-14 lg:py-14">
        <div className="mx-auto max-w-md">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Choose a demo account</h2>
          <p className="mt-2 text-ink-soft">
            Everyone here is fictional and already verified. A real deployment would use each resident&apos;s own sign-in.
          </p>
          <div className="mt-6">
            <LoginList accounts={accounts} />
          </div>
          <p className="mt-8 text-xs text-ink-faint">
            Hackathon concept. Not an official channel of any property company. Not for emergencies: call 999 if anyone is in danger.
          </p>
        </div>
      </section>
    </div>
  );
}
