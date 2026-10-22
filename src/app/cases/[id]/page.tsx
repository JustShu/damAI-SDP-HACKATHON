import { redirect } from "next/navigation";
import { EyeOff, Lock, ShieldAlert } from "lucide-react";
import { now } from "@/lib/clock";
import { AppError } from "@/lib/errors";
import { runPolicyChecks } from "@/lib/domain/policy";
import { getCaseView, type CaseView } from "@/lib/domain/views";
import { currentActorOrNull } from "@/lib/session";
import { ClarifyPanel, DraftReview } from "@/components/DraftReview";
import { RecipientRespond, ReporterOutcome, RequestReview } from "@/components/CaseActions";
import { Thread } from "@/components/Thread";
import { Timeline } from "@/components/Timeline";
import { Callout, Card, PageHeader, StatusBadge, categoryName, fmtDate } from "@/components/ui";

const BACK = { href: "/", label: "My concerns" };

export default async function CasePage({ params }: PageProps<"/cases/[id]">) {
  const actor = await currentActorOrNull();
  if (!actor) redirect("/");
  const { id } = await params;
  await runPolicyChecks(await now());

  let view: CaseView;
  try {
    view = await getCaseView(actor, id);
  } catch (e) {
    if (e instanceof AppError && e.status === 403) {
      return <PageHeader back={BACK} title="You don't have access to this" description="This case isn't shared with your account." />;
    }
    throw e;
  }

  const category = categoryName(view.category);

  if (view.role === "RECIPIENT") {
    return (
      <div>
        <PageHeader
          back={BACK}
          title={view.category === "OTHER" ? "A concern was shared with you" : `A ${category.toLowerCase()} concern was shared with you`}
          description={`Reported for ${fmtDate(view.occurredAt)}`}
          actions={<StatusBadge tone={view.tone} label={view.status} />}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <Callout icon={ShieldAlert} title="This is a reported concern, not a confirmed violation">
              It hasn&apos;t been independently verified. You can explain or dispute it, and your reply goes only to the AI mediator.
            </Callout>
            <Thread messages={view.thread} title="Your private conversation with the mediator" />
            {view.canRespond && <RecipientRespond key={view.thread.length} view={view} />}
          </div>
          <Sidebar view={view}>
            {view.canRequestReview && <RequestReview caseId={view.id} who="recipient" />}
            <Card className="p-4 text-sm text-ink-soft">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
                <EyeOff size={15} aria-hidden="true" /> About this channel
              </p>
              You won&apos;t be told who raised this, and they won&apos;t see your exact words. The mediator passes on only a summary you approve.
            </Card>
          </Sidebar>
        </div>
      </div>
    );
  }

  // Reporter, before anything is sent.
  if (view.state === "DRAFT" || view.state === "AWAITING_APPROVAL") {
    const ready = view.state === "AWAITING_APPROVAL" && view.draft;
    return (
      <div>
        <PageHeader
          back={BACK}
          title={ready ? "Review exactly what will be sent" : "The mediator needs a little more"}
          description={ready ? `Nothing goes to ${view.targetLabel} until you approve it.` : "Nothing has been sent. Update your report below."}
          actions={<StatusBadge tone={view.tone} label={view.status} />}
        />
        {ready ? <DraftReview key={view.draft!.id} view={view} /> : <ClarifyPanel key={view.mediatorQuestion ?? "none"} view={view} />}
      </div>
    );
  }

  const hasReply = view.thread.some((m) => m.kind === "RELAY" || m.kind === "REMINDER");
  return (
    <div>
      <PageHeader
        back={BACK}
        title={`${view.topic ? `"${view.topic}"` : `${category} concern`} about ${view.targetLabel}`}
        description={`Reported for ${fmtDate(view.occurredAt)}`}
        actions={<StatusBadge tone={view.tone} label={view.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {view.state === "SAFETY_ESCALATED" && (
            <Callout tone="danger" icon={ShieldAlert} title="Not sent as a neighbour notice">
              This may need urgent help or human review. Do not rely on this app for emergencies. If anyone is in immediate danger, call 999.
            </Callout>
          )}
          <Thread messages={view.thread} title="Your private conversation with the mediator" />
        </div>
        <Sidebar view={view}>
          {view.canConfirm && hasReply && (
            <Card className="p-4">
              <h2 className="mb-2 font-bold">Is it sorted?</h2>
              <ReporterOutcome caseId={view.id} allowUnresolved={view.state !== "UNRESOLVED"} />
            </Card>
          )}
          {view.canRequestReview && <RequestReview caseId={view.id} who="reporter" />}
          <details className="group rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold">
              <Lock size={15} aria-hidden="true" /> Your original report (private)
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-ink-soft">{view.rawText}</p>
          </details>
        </Sidebar>
      </div>
    </div>
  );
}

function Sidebar({ view, children }: { view: CaseView; children: React.ReactNode }) {
  const showProgress = !["CANCELLED", "SAFETY_ESCALATED"].includes(view.state);
  return (
    <aside className="space-y-4 lg:sticky lg:top-10 lg:self-start">
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink-soft">What happens next</h2>
        <p className="mt-1 text-[15px]">{view.nextStep}</p>
        {showProgress && (
          <div className="mt-4 border-t border-line pt-4">
            <Timeline steps={view.timeline} />
          </div>
        )}
      </Card>
      {children}
    </aside>
  );
}
