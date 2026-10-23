import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileWarning, Scale, Siren } from "lucide-react";
import { getOffsetMs, now } from "@/lib/clock";
import { FLAG_LABELS } from "@/lib/domain/constants";
import { runPolicyChecks } from "@/lib/domain/policy";
import { listQueue } from "@/lib/domain/review";
import { ALERT_STATUS_LABELS, ALERT_TYPE_LABELS, listAlertsForManager, type AlertType } from "@/lib/domain/emergency";
import { LiveRefresh } from "@/components/Emergency";
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
  const alerts = await listAlertsForManager(actor);
  const openAlerts = alerts.filter((a) => a.open);
  const safetyFirst = [...queue].sort((a, b) => Number(b.reason === "SAFETY") - Number(a.reason === "SAFETY"));

  return (
    <div>
      <LiveRefresh seconds={10} />
      <section id="alerts" className="mb-10 scroll-mt-24" aria-labelledby="alerts-title">
        <h2 id="alerts-title" className="mb-3 flex items-center gap-2 text-xl font-extrabold tracking-[-0.02em]">
          <Siren size={20} className="text-sos" aria-hidden="true" /> Urgent alerts
          {openAlerts.length > 0 && <span className="rounded-full bg-sos px-2.5 py-0.5 text-xs font-bold text-white">{openAlerts.length} open</span>}
        </h2>
        {alerts.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line-strong bg-white/50 px-5 py-6 text-center text-sm text-ink-soft">No urgent alerts. Residents use the SOS button for things happening right now, like a fight.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 [&>*]:min-w-0">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/manager/alerts/${a.id}`}
                  className={`group flex items-center gap-4 rounded-3xl p-4 shadow-lift transition ${a.open ? "bg-sos text-white hover:brightness-110" : "bg-white ring-1 ring-line hover:ring-ink/30"}`}
                >
                  <span className={`relative flex size-11 shrink-0 items-center justify-center rounded-2xl ${a.open ? "bg-white/20" : "bg-paper text-ink-soft"}`} aria-hidden="true">
                    {a.open && a.status === "NEW" && <span className="ping-soft absolute inset-0 rounded-2xl bg-white/40" />}
                    <Siren size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{ALERT_TYPE_LABELS[a.type as AlertType] ?? a.type}</span>
                    <span className={`block truncate text-sm ${a.open ? "text-white/85" : "text-ink-soft"}`}>{a.location} · from {a.reporterHousehold}</span>
                    <span className={`block text-xs ${a.open ? "text-white/75" : "text-ink-faint"}`}>{ALERT_STATUS_LABELS[a.status] ?? a.status} · {fmtDate(a.createdAt)}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 opacity-70 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PageHeader
        title="Review queue"
        description="Cases raised by fixed rules or by residents asking for a review. A flag asks for your judgement. It isn't a finding against anyone."
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0">
        <section aria-label="Open flags">
          {safetyFirst.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line-strong bg-white/50 px-5 py-8 text-center text-ink-soft">Nothing needs review right now.</p>
          ) : (
            <ul className="space-y-3">
              {safetyFirst.map((f) => {
                const Icon = REASON_ICON[f.reason] ?? Scale;
                const urgent = f.reason === "SAFETY";
                return (
                  <li key={f.id}>
                    <Link href={`/manager/flags/${f.id}`} className={`group flex items-center gap-4 rounded-3xl bg-white p-4 shadow-lift ring-1 transition hover:ring-ink/30 ${urgent ? "ring-2 ring-sos" : "ring-line"}`}>
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${urgent ? "bg-[#fde8e8] text-[#8a1f1f]" : "bg-navy text-white"}`} aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{FLAG_LABELS[f.reason]}</span>
                        <span className="block text-sm text-ink-soft">
                          {categoryName(f.category)} concern about {f.targetLabel}
                        </span>
                        <span className="block text-xs text-ink-faint">Flagged {fmtDate(f.createdAt)}</span>
                        {f.letterReady && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-coral-wash px-2.5 py-0.5 text-xs font-bold text-coral-ink ring-1 ring-coral/50">
                            <FileWarning size={13} aria-hidden="true" /> Warning letter ready to review
                          </span>
                        )}
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
