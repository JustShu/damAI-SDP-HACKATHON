import { redirect } from "next/navigation";
import { Home, MapPin, UserRound } from "lucide-react";
import { AppError } from "@/lib/errors";
import { ALERT_STATUS_LABELS, ALERT_TYPE_LABELS, getAlert, type AlertType } from "@/lib/domain/emergency";
import { currentActorOrNull } from "@/lib/session";
import { AlertTimeline } from "@/components/AlertTimeline";
import { AlertActions, LiveRefresh } from "@/components/Emergency";
import { PageHeader, fmtDate } from "@/components/ui";

const BACK = { href: "/manager#alerts", label: "Urgent alerts" };

// Manager view of one urgent alert: who/where, and the response buttons.
export default async function ManagerAlertPage({ params }: PageProps<"/manager/alerts/[id]">) {
  const actor = await currentActorOrNull();
  if (!actor) redirect("/");
  const { id } = await params;
  let a;
  try {
    a = await getAlert(actor, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 403) return <PageHeader back={BACK} title="You don't have access to this alert" />;
    throw e;
  }
  if (a.role !== "MANAGER") redirect(`/emergency/${a.id}`);

  return (
    <div>
      <LiveRefresh active={a.open} seconds={8} />
      <PageHeader back={BACK} title={ALERT_TYPE_LABELS[a.type as AlertType] ?? "Urgent alert"} description={`Raised ${fmtDate(a.createdAt)}`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
        <div className="space-y-5">
          <section className={`${a.open ? "bg-sos" : "bg-navy"} rounded-[28px] p-6 text-white shadow-lift`}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">Status</p>
            <p className="mt-1 text-[26px] font-extrabold">{ALERT_STATUS_LABELS[a.status] ?? a.status}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2.5">
                <MapPin size={16} aria-hidden="true" />
                <span>
                  <dt className="sr-only">Location</dt>
                  <dd className="font-semibold">{a.location}</dd>
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2.5">
                <UserRound size={16} aria-hidden="true" />
                <span>
                  <dt className="sr-only">Reported by</dt>
                  <dd className="font-semibold">{a.reporterName}</dd>
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2.5">
                <Home size={16} aria-hidden="true" />
                <span>
                  <dt className="sr-only">Household</dt>
                  <dd className="font-semibold">{a.reporterHousehold}</dd>
                </span>
              </div>
            </dl>
            {a.details && <p className="mt-4 rounded-2xl bg-white/10 p-4 text-[15px]">&ldquo;{a.details}&rdquo;</p>}
          </section>
          <section className="rounded-3xl bg-white p-5 shadow-lift ring-1 ring-line">
            <h2 className="mb-4 font-bold">What the resident has been told</h2>
            <AlertTimeline updates={a.updates} />
          </section>
        </div>
        <aside className="lg:sticky lg:top-10 lg:self-start">
          {a.open ? (
            <AlertActions alertId={a.id} status={a.status} />
          ) : (
            <p className="rounded-3xl bg-white p-5 text-sm shadow-lift ring-1 ring-line">This alert is closed.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
