import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Inbox, Plus, Send } from "lucide-react";
import { listDemoAccounts } from "@/lib/auth";
import { now } from "@/lib/clock";
import { runPolicyChecks } from "@/lib/domain/policy";
import { listCasesForActor } from "@/lib/domain/views";
import { currentActorOrNull } from "@/lib/session";
import { SignIn } from "@/components/SignIn";
import { CategoryTile, LinkButton, PageHeader, StatusBadge, categoryName, fmtDate, type Tone } from "@/components/ui";

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

  return (
    <div>
      <PageHeader
        title={`${greeting(at)}, ${actor.displayName.split(" ")[0]}`}
        description={`${actor.household.label}, Demo Park Residences`}
        actions={
          <LinkButton href="/cases/new">
            <Plus size={18} aria-hidden="true" /> Report a concern
          </LinkButton>
        }
      />

      {todo.length > 0 && (
        <section className="mb-10" aria-labelledby="todo">
          <h2 id="todo" className="mb-3 text-lg font-bold">Waiting on you</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {todo.map((r) => (
              <li key={r.id}>
                <Link href={`/cases/${r.id}`} className="group flex h-full items-center gap-4 rounded-2xl bg-white p-4 shadow-lift ring-1 ring-coral/60 transition hover:ring-coral">
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

      <div className="grid gap-10 xl:grid-cols-2">
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
        <p className="rounded-2xl border border-dashed border-line-strong px-5 py-6 text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
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
