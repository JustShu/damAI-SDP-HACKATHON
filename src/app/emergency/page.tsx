import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Phone, Siren } from "lucide-react";
import { ALERT_STATUS_LABELS, ALERT_TYPE_LABELS, listMyAlerts, type AlertType } from "@/lib/domain/emergency";
import { currentActorOrNull } from "@/lib/session";
import { EmergencyForm } from "@/components/Emergency";
import { PageHeader, fmtDate } from "@/components/ui";

// Urgent help: something is happening right now (e.g. neighbours fighting).
// Goes straight to community management, outside neighbour mediation.
export default async function EmergencyPage() {
  const actor = await currentActorOrNull();
  if (!actor) redirect("/");
  if (!actor.household) {
    return <PageHeader title="Urgent help" description="Only verified residents can send urgent alerts to community management." />;
  }
  const past = await listMyAlerts(actor);

  return (
    <div className="mx-auto max-w-xl">
      <section className="bg-sos relative mb-6 overflow-hidden rounded-[28px] p-6 text-white shadow-[0_20px_40px_-20px_rgb(225_29_72_/_0.8)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="relative flex size-12 items-center justify-center rounded-2xl bg-white/20">
            <span className="ping-soft absolute inset-0 rounded-2xl bg-white/30" aria-hidden="true" />
            <Siren size={26} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em]">Urgent help</h1>
            <p className="text-sm text-white/85">Alerts community management and security right away</p>
          </div>
        </div>
        <a
          href="tel:999"
          className="relative mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 font-bold text-sos-deep shadow-lift transition active:scale-[0.98]"
        >
          <span className="flex items-center gap-2.5">
            <Phone size={20} aria-hidden="true" /> Life in danger? Call 999 first
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </a>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-lift ring-1 ring-line sm:p-6">
        <EmergencyForm />
      </section>

      {past.length > 0 && (
        <section className="mt-8" aria-labelledby="past">
          <h2 id="past" className="mb-3 text-lg font-bold">Your alerts</h2>
          <ul className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-line">
            {past.map((a) => (
              <li key={a.id} className="border-b border-line last:border-0">
                <Link href={`/emergency/${a.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${a.open ? "bg-sos-wash text-sos-deep" : "bg-paper text-ink-soft"}`} aria-hidden="true">
                    <Siren size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{ALERT_TYPE_LABELS[a.type as AlertType] ?? a.type}</span>
                    <span className="block truncate text-sm text-ink-soft">
                      {a.location} · {fmtDate(a.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-ink-soft">{ALERT_STATUS_LABELS[a.status] ?? a.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
