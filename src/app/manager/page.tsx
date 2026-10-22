import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Scale } from "lucide-react";
import { getOffsetMs, now } from "@/lib/clock";
import { FLAG_LABELS } from "@/lib/domain/constants";
import { runPolicyChecks } from "@/lib/domain/policy";
import { listQueue } from "@/lib/domain/review";
import { currentActorOrNull } from "@/lib/session";
import { DemoControls } from "@/components/ManagerTools";
import { REASON_ICON } from "@/components/reasonIcons";
import { PageHeader, categoryName, fmtDate } from "@/components/ui";


export default async function ManagerPage() {
  const actor = await currentActorOrNull();
  if (!actor) redirect("/");
  if (!actor.managerCommunityIds.length) {
    return <PageHeader title="Review queue" description="Only authorised community managers can open the review queue." />;
  }
  const at = await now();
  await runPolicyChecks(at);
  const queue = await listQueue(actor);
  const safetyFirst = [...queue].sort((a, b) => Number(b.reason === "SAFETY") - Number(a.reason === "SAFETY"));

  return (
    <div>
      <PageHeader
        title="Review queue"
        description="Cases raised by fixed rules or by residents asking for a review. A flag asks for your judgement. It isn't a finding against anyone."
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Open flags">
          {safetyFirst.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-ink-soft">Nothing needs review right now.</p>
          ) : (
            <ul className="space-y-3">
              {safetyFirst.map((f) => {
                const Icon = REASON_ICON[f.reason] ?? Scale;
                const urgent = f.reason === "SAFETY";
                return (
                  <li key={f.id}>
                    <Link href={`/manager/flags/${f.id}`} className={`group flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 transition hover:shadow-lift ${urgent ? "ring-2 ring-[#d64545]" : "ring-line"}`}>
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${urgent ? "bg-[#fde8e8] text-[#8a1f1f]" : "bg-navy text-white"}`} aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{FLAG_LABELS[f.reason]}</span>
                        <span className="block text-sm text-ink-soft">
                          {categoryName(f.category)} concern about {f.targetLabel}
                        </span>
                        <span className="block text-xs text-ink-faint">Flagged {fmtDate(f.createdAt)}</span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-ink-faint transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside className="lg:sticky lg:top-10 lg:self-start">
          <DemoControls offsetDays={(await getOffsetMs()) / 86_400_000} appTime={fmtDate(at)} />
        </aside>
      </div>
    </div>
  );
}
