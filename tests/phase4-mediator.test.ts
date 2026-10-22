import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { approveDraft, createCase, generateDraft, updateDescription } from "@/lib/domain/cases";
import { analyseReport, summariseReply } from "@/lib/mediator/local";
import { scanOutbound } from "@/lib/domain/privacy";
import { actorFor, freshDemo, household, HOUR } from "./helpers";

beforeEach(freshDemo);

const at = new Date("2026-10-21T15:30:00Z");
const analyse = (category: "NOISE" | "PARKING" | "PET", rawText: string, tone: "FRIENDLY" | "FORMAL" | "BRIEF" = "FRIENDLY", attempt = 1) =>
  analyseReport({ category, occurredAt: at, rawText, tone, attempt });

async function report(description: string, category = "NOISE") {
  const reporter = await actorFor("resident39@example.test");
  const c = await createCase(reporter, { targetHouseholdId: (await household("House 18")).id, category, occurredAt: new Date(Date.now() - HOUR), description });
  return { reporter, c };
}

describe("Phase 4 — mediator understands the report", () => {
  it("declines a report whose aim is to upset someone, and sends nothing", async () => {
    const { c } = await report("I just want to disturb this guy life");
    expect(c.state).toBe("DRAFT");
    expect(await prisma.noticeDraft.count({ where: { caseId: c.id } })).toBe(0);
    const msg = await prisma.message.findFirstOrThrow({ where: { caseId: c.id, kind: "CLARIFY" } });
    expect(msg.body).toMatch(/only pass on concerns about something specific/);
  });

  it("routes a possible child-welfare concern to a human instead of a noise notice", async () => {
    const { c } = await report("Some loud noise in your garage. It heard like kid under 12 making some weird moan noise with old person. hmmmm sus");
    expect(c.state).toBe("SAFETY_ESCALATED");
    expect(await prisma.noticeDraft.count({ where: { caseId: c.id } })).toBe(0);
    const flag = await prisma.reviewFlag.findFirstOrThrow({ where: { caseId: c.id } });
    expect(flag).toMatchObject({ reason: "SAFETY", detail: "Possible child-welfare concern" });
    const status = await prisma.message.findFirstOrThrow({ where: { caseId: c.id, side: "REPORTER" } });
    expect(status.body).toMatch(/15999/);
  });

  it("asks a factual question when there's nothing concrete, then drafts once the reporter adds detail", async () => {
    const { reporter, c } = await report("They are so annoying honestly");
    expect(c.state).toBe("DRAFT");
    expect((await prisma.message.findFirstOrThrow({ where: { caseId: c.id, kind: "CLARIFY" } })).body).toMatch(/describe the noise/);

    const result = await updateDescription(reporter, c.id, "Loud music from their garage until 2am, every weekend.");
    expect(result.outcome).toBe("NOTICE");
    const draft = await prisma.noticeDraft.findFirstOrThrow({ where: { caseId: c.id } });
    expect(draft.text).toMatch(/loud music from the garage area/);
    expect(draft.text).toMatch(/more than once/);
  });

  it("carries what was reported into the notice, not a fixed template", () => {
    const music = analyse("NOISE", "Loud music again from their garage until 2am. Couldn't sleep.").noticeText;
    const drilling = analyse("NOISE", "Drilling and hammering since 7am on a Sunday").noticeText;
    expect(music).toMatch(/loud music/);
    expect(music).toMatch(/kept a neighbour awake/);
    expect(drilling).toMatch(/renovation or construction noise/);
    expect(drilling).toMatch(/permitted hours/);
    expect(music).not.toEqual(drilling);
  });

  it("regenerate and tone produce genuinely different versions", async () => {
    const { reporter, c } = await report("Loud music from 11pm, my kids couldn't sleep.");
    const first = await prisma.noticeDraft.findFirstOrThrow({ where: { caseId: c.id } });
    await generateDraft(reporter, c.id);
    await generateDraft(reporter, c.id, { tone: "FORMAL" });
    const drafts = await prisma.noticeDraft.findMany({ where: { caseId: c.id }, orderBy: { version: "asc" } });
    expect(new Set(drafts.map((d) => d.text)).size).toBe(3);
    expect(drafts[2].tone).toBe("FORMAL");
    expect(drafts[2].text).toMatch(/^(Dear|Good day)/);
    // Approving the first version is no longer possible: only the latest can go out.
    await expect(approveDraft(reporter, c.id, { draftId: first.id, textHash: first.textHash, acknowledgeInferenceRisk: true })).rejects.toMatchObject({ status: 409 });
  });

  it("summarises the recipient's actual reply in the third person", () => {
    const commit = summariseReply({ category: "PARKING", responseType: "COMMIT", text: "Sorry! My son parked there. I'll make sure entrances stay clear." }).relayText;
    expect(commit).toBe(
      "The other household apologised and acknowledged the concern. They explained that someone in their household parked there. They said they'll make sure entrances stay clear.",
    );
    const dispute = summariseReply({ category: "NOISE", responseType: "DISPUTE", text: "That wasn't us, we were away all weekend." }).relayText;
    expect(dispute).toMatch(/disputes the concern/);
    expect(dispute).toMatch(/they were away all weekend/);
    expect(dispute).not.toMatch(/\bwe\b|\bus\b/i);
  });

  it("the mediator's own wording never trips the privacy warnings", () => {
    const ctx = { senderHouseholdLabel: "House 39", senderHouseholdUnit: "39", senderName: "Daniel Lim" };
    const reports = { NOISE: "Loud music again until 2am", PARKING: "Blocking my driveway again", PET: "Dog barking for hours" } as const;
    for (const [category, text] of Object.entries(reports))
      for (const tone of ["FRIENDLY", "FORMAL", "BRIEF"] as const)
        for (const attempt of [1, 2, 3]) {
          const notice = analyse(category as "NOISE", text, tone, attempt).noticeText;
          expect(scanOutbound(notice, ctx), notice).toEqual([]);
        }
  });
});
