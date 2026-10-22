import { redirect } from "next/navigation";
import { Eye, Lock, MessageSquareText } from "lucide-react";
import { listTargetableHouseholds } from "@/lib/domain/cases";
import { currentActorOrNull } from "@/lib/session";
import { MediatorAvatar } from "@/components/brand";
import { NewConcernForm } from "@/components/NewConcernForm";
import { Card, PageHeader } from "@/components/ui";

const STEPS = [
  { Icon: Lock, title: "You tell the mediator", text: "Your words stay private. The other household never sees them." },
  { Icon: MessageSquareText, title: "It drafts a neutral notice", text: "Facts only, no blame, nothing that names you. It asks if anything is unclear." },
  { Icon: Eye, title: "You approve the exact text", text: "Nothing is sent until you've seen it. Then they reply privately to the mediator." },
];

export default async function NewConcernPage() {
  const actor = await currentActorOrNull();
  if (!actor?.household) redirect("/");
  const households = await listTargetableHouseholds(actor);
  return (
    <div>
      <PageHeader back={{ href: "/", label: "My concerns" }} title="Report a concern" description="Tell the mediator what happened. You'll review everything before anything is sent." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5 sm:p-7">
          <NewConcernForm households={households} />
        </Card>
        <aside className="space-y-4 lg:sticky lg:top-10 lg:self-start">
          <div className="flex items-center gap-3">
            <MediatorAvatar size={40} />
            <div className="leading-tight">
              <p className="font-bold">AI Community Mediator</p>
              <p className="text-sm text-ink-soft">A neutral go-between, not a judge</p>
            </div>
          </div>
          <ol className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-line">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-wash text-sm font-bold text-teal-ink">{i + 1}</span>
                <div>
                  <p className="flex items-center gap-1.5 font-semibold">
                    <Icon size={15} aria-hidden="true" className="text-ink-soft" />
                    {title}
                  </p>
                  <p className="text-sm text-ink-soft">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="px-1 text-xs leading-relaxed text-ink-soft">
            Your identity is hidden from the recipient by default, but they may still guess from the circumstances. Community management
            can see who raised a concern if a review needs it.
          </p>
        </aside>
      </div>
    </div>
  );
}
