import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { approveDraft, confirmStatus, createCase, generateDraft, sendNotice } from "@/lib/domain/cases";
import { analyseReport } from "@/lib/mediator/local";
import { geminiProvider } from "@/lib/mediator/gemini";
import { actorFor, freshDemo, household, DAY, HOUR } from "./helpers";

beforeEach(freshDemo);

async function reportOther(email: string, topic: string, description: string, occurredAt = new Date(Date.now() - HOUR)) {
  const reporter = await actorFor(email);
  const c = await createCase(reporter, { targetHouseholdId: (await household("House 18")).id, category: "OTHER", topic, occurredAt, description });
  return { reporter, c };
}

describe('Phase 5 — "Other" concerns', () => {
  it("needs a short, neutral topic", async () => {
    const reporter = await actorFor("resident39@example.test");
    const target = (await household("House 18")).id;
    const base = { targetHouseholdId: target, category: "OTHER", occurredAt: new Date(Date.now() - HOUR), description: "Rubbish bags left outside for days." };
    await expect(createCase(reporter, base)).rejects.toMatchObject({ status: 400 });
    await expect(createCase(reporter, { ...base, topic: "x".repeat(61) })).rejects.toMatchObject({ status: 400 });
    await expect(createCase(reporter, { ...base, topic: "Rubbish from that idiot" })).rejects.toMatchObject({ status: 400 });
  });

  it("drafts a neutral notice for a common issue, leaving identifying details out", async () => {
    const { c } = await reportOther("resident39@example.test", "Rubbish left outside", "Bags of rubbish left next to my gate for days, it smells and attracts rats.");
    expect(c.state).toBe("AWAITING_APPROVAL");
    const d = await prisma.noticeDraft.findFirstOrThrow({ where: { caseId: c.id } });
    expect(d.text).toMatch(/rubbish/i);
    expect(d.text).toMatch(/closed bins/);
    expect(d.text).not.toMatch(/my gate/i);
    expect(JSON.parse(d.removedJson).some((r: { span: string }) => r.span.startsWith("my gate"))).toBe(true);
  });

  it("uses the reporter's topic for anything the built-in rules don't know", () => {
    const out = analyseReport({
      category: "OTHER",
      topic: "Loud wind chimes",
      occurredAt: new Date("2026-10-21T15:30:00Z"),
      rawText: "The chimes outside clang constantly whenever it's windy.",
      tone: "FRIENDLY",
      attempt: 1,
    });
    expect(out.outcome).toBe("NOTICE");
    expect(out.noticeText).toContain('"Loud wind chimes"');
  });

  it("can be regenerated, including with a different tone", async () => {
    const { reporter, c } = await reportOther("resident39@example.test", "Water dripping from aircon", "Water drips from their aircon unit onto the walkway every evening.");
    await generateDraft(reporter, c.id);
    await generateDraft(reporter, c.id, { tone: "FORMAL" });
    const drafts = await prisma.noticeDraft.findMany({ where: { caseId: c.id }, orderBy: { version: "asc" } });
    expect(drafts).toHaveLength(3);
    expect(new Set(drafts.map((d) => d.text)).size).toBe(3);
    expect(drafts[2].tone).toBe("FORMAL");
  });

  it("is never grouped with, or counted alongside, other 'Other' reports", async () => {
    const unresolved = async (email: string, topic: string, desc: string, daysAgo: number) => {
      const { reporter, c } = await reportOther(email, topic, desc, new Date(Date.now() - daysAgo * DAY));
      const d = await prisma.noticeDraft.findFirstOrThrow({ where: { caseId: c.id } });
      await approveDraft(reporter, c.id, { draftId: d.id, textHash: d.textHash, acknowledgeInferenceRisk: true });
      await sendNotice(reporter, c.id, { draftId: d.id, idempotencyKey: `k-${c.id}` });
      await confirmStatus(reporter, c.id, { status: "UNRESOLVED" });
      return prisma.case.findUniqueOrThrow({ where: { id: c.id } });
    };
    const a = await unresolved("resident39@example.test", "Rubbish left outside", "Rubbish bags left out for days.", 2);
    const b = await unresolved("resident22@example.test", "Overhanging branches", "Tree branches hang over the walkway.", 2);
    await unresolved("resident25@example.test", "Smoke from burning", "They burn leaves and the smoke comes in.", 1);
    expect(a.incidentId).not.toBe(b.incidentId);
    expect(await prisma.reviewFlag.count({ where: { reason: "REPEAT_UNRESOLVED", category: "OTHER" } })).toBe(0);
  });
});

describe("Phase 5 — Gemini provider (no real API calls)", () => {
  const saved = { provider: process.env.MEDIATOR_PROVIDER, key: process.env.GEMINI_API_KEY };
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.MEDIATOR_PROVIDER = saved.provider;
    process.env.GEMINI_API_KEY = saved.key;
  });

  const geminiReply = (json: unknown) =>
    vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), { status: 200 }));

  it("sends the topic to Gemini and uses its notice", async () => {
    process.env.MEDIATOR_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = geminiReply({
      outcome: "NOTICE",
      mediatorMessage: "Here's a neutral version.",
      caseSummary: "Rubbish left outside",
      noticeText: "Hello, a neighbour mentioned rubbish bags reportedly left outside your home for several days. Could you please keep rubbish in closed bins? This hasn't been verified, and you can reply privately here.",
      removedDetails: [],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { c } = await reportOther("resident39@example.test", "Rubbish left outside", "Rubbish bags left next to my gate for days.");
    const d = await prisma.noticeDraft.findFirstOrThrow({ where: { caseId: c.id } });
    expect(d.provider).toMatch(/^gemini:/);
    expect(d.text).toMatch(/rubbish bags reportedly left outside/);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.contents[0].parts[0].text).toContain("<topic>Rubbish left outside</topic>");
  });

  it("explains Google's error, and the built-in mediator still writes the notice", async () => {
    process.env.MEDIATOR_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "bad-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "API key not valid." } }), { status: 400 })));

    await expect(geminiProvider.draftNotice({ category: "NOISE", occurredAt: new Date(), rawText: "Loud music", tone: "FRIENDLY", attempt: 1 })).rejects.toThrow(
      /400: API key not valid\. \(check GEMINI_API_KEY/,
    );

    const { c } = await reportOther("resident39@example.test", "Rubbish left outside", "Rubbish bags left out for days.");
    const d = await prisma.noticeDraft.findFirstOrThrow({ where: { caseId: c.id } });
    expect(d.provider).toBe("built-in-v2");
    expect(c.state).toBe("AWAITING_APPROVAL");
  });
});
