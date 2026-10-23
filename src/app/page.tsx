import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Inbox, Plus, Send, Siren } from "lucide-react";
import { listDemoAccounts } from "@/lib/auth";
import { now } from "@/lib/clock";
import { runPolicyChecks } from "@/lib/domain/policy";
import { listCasesForActor } from "@/lib/domain/views";
import { ALERT_STATUS_LABELS, ALERT_TYPE_LABELS, listMyAlerts, type AlertType } from "@/lib/domain/emergency";
import { currentActorOrNull } from "@/lib/session";
import { SignIn } from "@/components/SignIn";
import { CategoryTile, PageHeader, StatusBadge, categoryName, fmtDate, type Tone } from "@/components/ui";

type Row = { id: string; category: string; state: string; status: string; tone: Tone; action: string | null; title: string; when: string };

function greeting(d: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kuala_Lumpur" }).format(d));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function Home() {
  const actor = await currentActorOrNull();
  if (!actor) return <SignIn accounts={await listDemoAccounts()} />;

  if (!actor.household) {
    if (actor.managerCommunityIds.length) redirect("/manager");
    return (
      <PageHeader
        title="Your membership isn't verified yet"
        description="You can't raise or receive concerns until community management verifies that you live here."
      />
    );
  }

  const at = await now();
  await runPolicyChecks(at);
  const { raised, received } = await listCasesForActor(actor);

  const receivedRows: Row[] = received.map((c) => ({ ...c, title: c.category === "OTHER" ? "A concern shared with you" : `${categoryName(c.category)} concern shared with you`, when: `Reported for ${fmtDate(c.occurredAt)}` }));
  const raisedRows: Row[] = raised.map((c) => ({ ...c, title: `${c.topic ? `"${c.topic}"` : `${categoryName(c.category)} concern`} about ${c.targetLabel}`, when: fmtDate(c.occurredAt) }));
  const todo = [...receivedRows, ...raisedRows].filter((r) => r.action);

  const alerts = (await listMyAlerts(actor)).filter((a) => a.open);

  return (
    <div>
      {/* Welcome card with the two main actions. */}
      <section className="bg-damai relative mb-8 overflow-hidden rounded-[28px] p-6 text-white shadow-[0_20px_40px_-20px_rgb(47_111_214_/_0.7)] sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-10 size-48 rounded-full bg-[#5b4cf0]/40 blur-2xl" />
        <p className="relative text-sm font-semibold text-white/80">{greeting(at)},</p>
        <h1 className="relative mt-0.5 text-[30px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[36px]">{actor.displayName.split(" ")[0]} 👋</h1>
        <p className="relative mt-1 text-sm text-white/80">{actor.household.label} · Demo Park Residences</p>
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
          <Link href="/cases/new" className="flex flex-col gap-2 rounded-2xl bg-white/95 p-4 text-navy shadow-lift transition hover:bg-white active:scale-[0.98]">
            <span className="flex size-10 items-center justify-center rounded-xl bg-damai text-white">
              <Plus size={22} strokeWidth={2.6} aria-hidden="true" />
            </span>
            <span className="font-bold leading-tight">Report a concern</span>
            <span className="text-xs text-ink-soft">Noise, parking, pets, other</span>
          </Link>
          <Link href="/emergency" className="flex flex-col gap-2 rounded-2xl bg-sos p-4 text-white shadow-lift ring-1 ring-white/30 transition hover:brightness-110 active:scale-[0.98]">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/20">
              <Siren size={22} aria-hidden="true" />
            </span>
            <span className="font-bold leading-tight">Urgent help</span>
            <span className="text-xs text-white/85">Fight, injury, intruder</span>
          </Link>
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="mb-8" aria-labelledby="alerts">
          <h2 id="alerts" className="mb-3 flex items-center gap-2 text-lg font-bold">
            <span className="relative flex size-2.5">
              <span className="ping-soft absolute inline-flex size-full rounded-full bg-sos" />
              <span className="relative inline-flex size-2.5 rounded-full bg-sos" />
            </span>
            Your urgent alerts
          </h2>
          <ul className="space-y-2.5">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link href={`/emergency/${a.id}`} className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-lift ring-2 ring-sos/40 transition hover:ring-sos">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sos-wash text-sos-deep" aria-hidden="true">
                    <Siren size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{ALERT_TYPE_LABELS[a.type as AlertType] ?? a.type}</span>
                    <span className="block truncate text-sm text-ink-soft">{a.location}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-sos-wash px-2.5 py-1 text-xs font-bold text-sos-deep">{ALERT_STATUS_LABELS[a.status] ?? a.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {todo.length > 0 && (
        <section className="mb-10" aria-labelledby="todo">
          <h2 id="todo" className="mb-3 text-lg font-bold">Waiting on you</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {todo.map((r) => (
              <li key={r.id}>
                <Link href={`/cases/${r.id}`} className="group flex h-full items-center gap-4 rounded-3xl bg-white p-4 shadow-lift ring-2 ring-coral/50 transition hover:ring-coral">
                  <CategoryTile category={r.category} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{r.action}</span>
                    <span className="block truncate text-sm text-ink-soft">{r.title}</span>
                  </span>
                  <ArrowRight size={18} className="shrink-0 text-coral-ink transition group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2 [&>*]:min-w-0">
        <CaseList
          icon={<Inbox size={18} aria-hidden="true" />}
          title="Shared with your household"
          empty="Nothing has been shared with your household. If a neighbour raises a concern, it appears here as a private message from the mediator."
          rows={receivedRows}
        />
        <CaseList
          icon={<Send size={18} aria-hidden="true" />}
          title="Raised by you"
          empty="You haven't raised anything. When something bothers you, report it and the mediator handles the conversation."
          rows={raisedRows}
        />
      </div>
    </div>
  );
}

function CaseList({ icon, title, empty, rows }: { icon: React.ReactNode; title: string; empty: string; rows: Row[] }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span className="text-ink-soft">{icon}</span>
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line-strong bg-white/50 px-5 py-6 text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-line">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-line last:border-0">
              <Link href={`/cases/${r.id}`} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-paper">
                <CategoryTile category={r.category} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.title}</span>
                  <span className="block text-sm text-ink-soft">{r.when}</span>
                </span>
                <StatusBadge tone={r.tone} label={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
