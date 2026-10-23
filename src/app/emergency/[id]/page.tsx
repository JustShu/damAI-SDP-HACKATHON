import { redirect } from "next/navigation";
import { MapPin, Phone, Shield, Siren } from "lucide-react";
import { AppError } from "@/lib/errors";
import { ALERT_STATUS_LABELS, ALERT_TYPE_LABELS, getAlert, type AlertType } from "@/lib/domain/emergency";
import { currentActorOrNull } from "@/lib/session";
import { AlertTimeline } from "@/components/AlertTimeline";
import { CancelAlertButton, LiveRefresh } from "@/components/Emergency";
import { PageHeader } from "@/components/ui";

const BACK = { href: "/emergency", label: "Urgent help" };

// The reporter's live view: updates (e.g. "Security is on the way") appear
// automatically while the alert is open.
export default async function AlertPage({ params }: PageProps<"/emergency/[id]">) {
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
  if (a.role === "MANAGER") redirect(`/manager/alerts/${a.id}`);

  const dispatched = a.status === "DISPATCHED";
  const hero =
    a.status === "RESOLVED"
      ? "bg-damai"
      : a.status === "CANCELLED"
        ? "bg-navy"
        : "bg-sos";

  return (
    <div className="mx-auto max-w-xl">
      <LiveRefresh active={a.open} seconds={5} />
      <PageHeader back={BACK} title={ALERT_TYPE_LABELS[a.type as AlertType] ?? "Urgent alert"} />

      <section className={`${hero} relative mb-6 overflow-hidden rounded-[28px] p-6 text-white shadow-lift`} aria-live="polite">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-white/20 blur-2xl" />
        <p className="relative text-xs font-bold uppercase tracking-[0.14em] text-white/80">Status</p>
        <p className="relative mt-1 flex items-center gap-3 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">
          {a.open && (
            <span className="relative flex size-3">
              <span className="ping-soft absolute inline-flex size-full rounded-full bg-white" />
              <span className="relative inline-flex size-3 rounded-full bg-white" />
            </span>
          )}
          {ALERT_STATUS_LABELS[a.status] ?? a.status}
        </p>
        {dispatched && (
          <p className="relative mt-3 flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 font-semibold">
            <Shield size={20} aria-hidden="true" />
            Security is on the way{a.etaMinutes ? ` · about ${a.etaMinutes} min` : ""}
          </p>
        )}
        <p className="relative mt-3 flex items-center gap-1.5 text-sm text-white/85">
          <MapPin size={15} aria-hidden="true" /> {a.location}
        </p>
        {a.open && <p className="relative mt-1 text-xs text-white/70">This page updates by itself.</p>}
      </section>

      <section className="mb-6 rounded-3xl bg-white p-5 shadow-lift ring-1 ring-line sm:p-6">
        <h2 className="mb-4 font-bold">Updates</h2>
        <AlertTimeline updates={a.updates} />
      </section>

      {a.open && (
        <div className="space-y-3">
          <a href="tel:999" className="flex items-center justify-center gap-2 rounded-2xl bg-sos-wash px-4 py-3.5 font-bold text-sos-deep ring-1 ring-sos/30">
            <Phone size={18} aria-hidden="true" /> Things getting worse? Call 999
          </a>
          <CancelAlertButton alertId={a.id} />
        </div>
      )}
      {!a.open && (
        <p className="flex items-center justify-center gap-2 text-sm text-ink-soft">
          <Siren size={15} aria-hidden="true" /> This alert is closed.
        </p>
      )}
    </div>
  );
}
