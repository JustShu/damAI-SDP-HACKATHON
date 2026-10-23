import { redirect } from "next/navigation";
import { FileWarning, Home, Scale } from "lucide-react";
import { now } from "@/lib/clock";
import { AppError } from "@/lib/errors";
import { DECISION_LABELS, FLAG_LABELS, MANAGER_DECISIONS } from "@/lib/domain/constants";
import { getReviewDetail } from "@/lib/domain/review";
import { getHouseholdReport } from "@/lib/domain/warnings";
import { WarningLetterForm } from "@/components/WarningLetter";
import { currentActorOrNull } from "@/lib/session";
import { IncidentTrack } from "@/components/IncidentTrack";
import { DecisionForm, RevealPanel } from "@/components/ManagerTools";
import { Callout, Card, PageHeader, categoryName, fmtDate } from "@/components/ui";
import { REASON_ICON } from "@/components/reasonIcons";

const BACK = { href: "/manager", label: "Review queue" };

export default async function FlagPage({ params }: PageProps<"/manager/flags/[id]">) {
  const actor = await currentActorOrNull();
  if (!actor) redirect("/");
  const { id } = await params;
  let d;
  try {
    d = await getReviewDetail(actor, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 403) return <PageHeader back={BACK} title="You don't have access to this review" />;
    throw e;
  }
  const Icon = REASON_ICON[d.flag.reason] ?? Scale;
  const report = d.flag.reason === "REPEAT_UNRESOLVED" ? await getHouseholdReport(actor, id) : null;
  const stream = (side: string) => d.messages.filter((m) => m.side === side);

  return (
    <div>
      <PageHeader
        back={BACK}
        title={FLAG_LABELS[d.flag.reason]}
        description={
          <span className="flex items-center gap-2">
            <Icon size={16} aria-hidden="true" />
            {categoryName(d.case.category)} concern about {d.case.targetLabel}. {d.flag.detail}.
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] [&>*]:min-w-0">
        <div className="space-y-5">
          {d.case.disputed && (
            <Callout icon={Scale} title="Disputed">
              The recipient household disputes this concern. Disputed incidents don&apos;t count toward the repeat threshold.
            </Callout>
          )}
          {report && (
            <Card className="p-5">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
                <Home size={18} aria-hidden="true" /> Household report: {report.household.label}
              </h2>
              <p className="mb-4 text-sm text-ink-soft">
                For management only. Who reported stays hidden unless you reveal it (logged). {report.household.verifiedResidents} verified resident{report.household.verifiedResidents === 1 ? "" : "s"} in this household.
              </p>
              <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-coral-wash p-3">
                  <dt className="text-xs font-semibold text-coral-ink">Unresolved ({categoryName(report.category).toLowerCase()})</dt>
                  <dd className="text-2xl font-extrabold text-coral-ink">{report.qualifying.length}</dd>
                </div>
                <div className="rounded-2xl bg-paper p-3">
                  <dt className="text-xs font-semibold text-ink-soft">Concerns, 90 days</dt>
                  <dd className="text-2xl font-extrabold">{report.concernsLast90Days.reduce((n, c) => n + c.count, 0)}</dd>
                </div>
                <div className="rounded-2xl bg-paper p-3">
                  <dt className="text-xs font-semibold text-ink-soft">Disputed</dt>
                  <dd className="text-2xl font-extrabold">{report.disputedCount}</dd>
                </div>
              </dl>
              {report.concernsLast90Days.length > 0 && (
                <p className="mb-3 text-sm">
                  <span className="font-semibold">By type (90 days): </span>
                  {report.concernsLast90Days.map((c) => `${categoryName(c.category)} ${c.count}`).join(" · ")}
                </p>
              )}
              <h3 className="mb-1.5 text-sm font-bold">How the household responded</h3>
              {report.responses.length === 0 ? (
                <p className="mb-3 text-sm text-ink-soft">No replies shared.</p>
              ) : (
                <ul className="mb-3 space-y-1.5 text-sm">
                  {report.responses.map((r, i) => (
                    <li key={i} className="rounded-xl bg-paper px-3 py-2">
                      <span className="font-semibold">{r.type}</span>, {fmtDate(r.at)}: {r.summary}
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mb-1.5 text-sm font-bold">Earlier management actions</h3>
              {report.previousActions.length === 0 ? (
                <p className="text-sm text-ink-soft">None.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {report.previousActions.map((a, i) => (
                    <li key={i}>
                      {DECISION_LABELS[a.decision as keyof typeof DECISION_LABELS] ?? a.decision}, {fmtDate(a.at)} ({a.policyRef})
                    </li>
                  ))}
                </ul>
              )}
              {report.letter?.status === "SENT" && (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-coral-ink">
                  <FileWarning size={15} aria-hidden="true" /> Warning letter sent {report.letter.sentAt ? fmtDate(report.letter.sentAt) : ""}
                </p>
              )}
            </Card>
          )}
          <IncidentTrack incidents={d.incidents} now={await now()} />

          {d.approvedNotice && (
            <Card className="p-5">
              <h2 className="mb-2 font-bold">Notice the reporter approved</h2>
              <p className="whitespace-pre-wrap rounded-xl bg-teal-wash p-4 text-[15px]">{d.approvedNotice}</p>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {(["REPORTER", "RECIPIENT"] as const).map((side) => (
              <Card key={side} className="p-4">
                <h2 className="mb-3 font-bold">{side === "REPORTER" ? "Reporter's private stream" : "Recipient's private stream"}</h2>
                <ol className="space-y-2.5 text-sm">
                  {stream(side).map((m, i) => (
                    <li key={i} className={`rounded-xl p-3 ${m.author === "RESIDENT" ? "bg-navy text-white" : m.kind === "MANAGEMENT" ? "ring-2 ring-navy" : "bg-paper"}`}>
                      <span className={`mb-0.5 block text-xs ${m.author === "RESIDENT" ? "text-white/70" : "text-ink-soft"}`}>
                        {m.author === "RESIDENT" ? "Resident" : m.kind === "MANAGEMENT" ? "Management" : "Mediator"}, {fmtDate(m.createdAt)}
                      </span>
                      {m.body}
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>

          {d.actions.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-2 font-bold">Earlier decisions</h2>
              <ul className="space-y-2 text-sm">
                {d.actions.map((a, i) => (
                  <li key={i}>
                    <span className="font-semibold">{DECISION_LABELS[a.decision as keyof typeof DECISION_LABELS]}</span>, {fmtDate(a.createdAt)}. {a.rationale} ({a.policyRef})
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-10 lg:self-start">
          {d.flag.status === "OPEN" && report?.letter?.status === "DRAFT" && <WarningLetterForm flagId={d.flag.id} draftText={report.letter.draftText} />}
          <RevealPanel flagId={d.flag.id} />
          {d.flag.status === "OPEN" ? (
            <DecisionForm flagId={d.flag.id} options={MANAGER_DECISIONS.map((v) => ({ value: v, label: DECISION_LABELS[v] }))} />
          ) : (
            <Card className="p-4 text-sm">This flag has been decided.</Card>
          )}
        </aside>
      </div>
    </div>
  );
}
