import { redirect } from "next/navigation";
import { Scale } from "lucide-react";
import { now } from "@/lib/clock";
import { AppError } from "@/lib/errors";
import { DECISION_LABELS, FLAG_LABELS, MANAGER_DECISIONS } from "@/lib/domain/constants";
import { getReviewDetail } from "@/lib/domain/review";
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {d.case.disputed && (
            <Callout icon={Scale} title="Disputed">
              The recipient household disputes this concern. Disputed incidents don&apos;t count toward the repeat threshold.
            </Callout>
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
