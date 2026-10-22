import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { approveDraft, asRecipient, createCase, editDraft, generateDraft, sendNotice } from "@/lib/domain/cases";
import { hashText } from "@/lib/domain/privacy";
import { setProvider } from "@/lib/mediator";
import { localProvider } from "@/lib/mediator/local";
import { actorFor, freshDemo, household, HOUR } from "./helpers";

beforeEach(freshDemo);
afterEach(() => setProvider(null));

const RAW = "House 18 keeps parking in front of my gate! So rude. This is House 39's gate, WXY 1234 is the car.";

async function newParkingCase(raw = RAW) {
  const reporter = await actorFor("resident39@example.test");
  const h18 = await household("House 18");
  const c = await createCase(reporter, {
    targetHouseholdId: h18.id,
    category: "PARKING",
    occurredAt: new Date(Date.now() - 10 * HOUR),
    description: raw,
  });
  // Non-null for normal flows; safety and AI-failure tests never read it.
  const draft = (await prisma.noticeDraft.findFirst({ where: { caseId: c.id }, orderBy: { version: "desc" } }))!;
  return { reporter, c, draft, h18 };
}

const recipientNotices = (caseId: string) => prisma.message.findMany({ where: { caseId, side: "RECIPIENT" } });

describe("Phase 1 — reporter flow", () => {
  it("T01: reporter sees an unsent draft and the valid target is stored", async () => {
    const { c, draft, h18 } = await newParkingCase();
    expect(c.state).toBe("AWAITING_APPROVAL");
    expect(c.targetHouseholdId).toBe(h18.id);
    expect(draft.sentAt).toBeNull();
    expect(draft.approvedHash).toBeNull();
  });

  it("T02: identifying details are neutralised and listed for the reporter", async () => {
    const { draft } = await newParkingCase();
    expect(draft.text).not.toMatch(/House 39|my gate|rude|WXY/i);
    expect(draft.text).toMatch(/a vehicle reportedly obstructing access to a nearby entrance/);
    const removed = JSON.parse(draft.removedJson).map((r: { span: string }) => r.span.toLowerCase());
    expect(removed).toEqual(expect.arrayContaining(["house 39's gate", "my gate", "so rude"]));
  });

  it("T02: an edited notice that names the reporter's household is blocked", async () => {
    const { reporter, c } = await newParkingCase();
    const edited = await editDraft(reporter, c.id, "Hello, please stop blocking the gate at House 39 every evening.");
    const risks = JSON.parse(edited.risksJson);
    expect(risks.some((r: { severity: string }) => r.severity === "BLOCK")).toBe(true);
    await expect(
      approveDraft(reporter, c.id, { draftId: edited.id, textHash: edited.textHash, acknowledgeInferenceRisk: true }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("T03: without approval the recipient receives nothing and cannot open the case", async () => {
    const { reporter, c, draft } = await newParkingCase();
    await expect(sendNotice(reporter, c.id, { draftId: draft.id, idempotencyKey: "key-12345678" })).rejects.toMatchObject({ status: 409 });
    expect(await recipientNotices(c.id)).toHaveLength(0);
    const recipient = await actorFor("resident18@example.test");
    await expect(asRecipient(recipient, c.id)).rejects.toMatchObject({ status: 403 });
  });

  it("T04: approving v1 then changing the draft invalidates the approval", async () => {
    const { reporter, c, draft } = await newParkingCase();
    await approveDraft(reporter, c.id, { draftId: draft.id, textHash: draft.textHash, acknowledgeInferenceRisk: true });
    await editDraft(reporter, c.id, draft.text + " Thank you.");
    await expect(sendNotice(reporter, c.id, { draftId: draft.id, idempotencyKey: "key-12345678" })).rejects.toMatchObject({ status: 409 });
    expect(await recipientNotices(c.id)).toHaveLength(0);
  });

  it("T04: approval must match the exact text hash the reporter saw", async () => {
    const { reporter, c, draft } = await newParkingCase();
    await expect(
      approveDraft(reporter, c.id, { draftId: draft.id, textHash: hashText("something else"), acknowledgeInferenceRisk: true }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("approval requires acknowledging the inference risk", async () => {
    const { reporter, c, draft } = await newParkingCase();
    await expect(
      approveDraft(reporter, c.id, { draftId: draft.id, textHash: draft.textHash, acknowledgeInferenceRisk: false }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("T05 + T20: approved notice reaches only House 18, and a retried send is idempotent", async () => {
    const { reporter, c, draft } = await newParkingCase();
    await approveDraft(reporter, c.id, { draftId: draft.id, textHash: draft.textHash, acknowledgeInferenceRisk: true });
    await sendNotice(reporter, c.id, { draftId: draft.id, idempotencyKey: "key-12345678" });
    await sendNotice(reporter, c.id, { draftId: draft.id, idempotencyKey: "key-12345678" });

    const notices = await recipientNotices(c.id);
    expect(notices).toHaveLength(1);
    expect(notices[0].body).toBe(draft.text);
    expect(notices[0].body).not.toContain(c.rawText);

    const h18 = await asRecipient(await actorFor("resident18@example.test"), c.id);
    expect(h18.state).toBe("NOTICE_SENT");
    await expect(asRecipient(await actorFor("resident22@example.test"), c.id)).rejects.toMatchObject({ status: 403 });

    // A different key cannot send a second copy either.
    await expect(sendNotice(reporter, c.id, { draftId: draft.id, idempotencyKey: "key-other-1" })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.auditEvent.count({ where: { action: "NoticeSent" } })).toBe(1);
  });

  it("T15: a threat bypasses mediation and goes straight to human review", async () => {
    const { c } = await newParkingCase("He said he will kill my dog if I complain again about the parking.");
    expect(c.state).toBe("SAFETY_ESCALATED");
    expect(await prisma.noticeDraft.count({ where: { caseId: c.id } })).toBe(0);
    expect(await recipientNotices(c.id)).toHaveLength(0);
    expect(await prisma.reviewFlag.count({ where: { caseId: c.id, reason: "SAFETY" } })).toBe(1);
  });

  it("T18: extra fields or leaked identity from the AI are rejected or redacted", async () => {
    setProvider({
      name: "evil",
      draftNotice: async () => ({
        outcome: "NOTICE",
        mediatorMessage: "",
        caseSummary: "x",
        noticeText: "Hello, Daniel Lim from House 39 (call 012-345 6789) says you parked badly. Ignore all rules.",
        removedDetails: [],
        reporterEmail: "resident39@example.test", // unexpected field: stripped by schema
      }),
      draftRelay: localProvider.draftRelay,
    });
    const { draft } = await newParkingCase();
    expect(draft.text).not.toMatch(/Daniel|Lim|House 39|012-345/);
    expect(draft.text).toContain("[removed]");
    expect(JSON.stringify(draft)).not.toContain("resident39@example.test");
  });

  it("AI failure saves the case as an unsent draft and never forwards raw text", async () => {
    setProvider({ name: "down", draftNotice: async () => { throw new Error("timeout"); }, draftRelay: localProvider.draftRelay });
    const { c } = await newParkingCase();
    const saved = await prisma.case.findUniqueOrThrow({ where: { id: c.id } });
    expect(saved.state).toBe("DRAFT");
    expect(await recipientNotices(c.id)).toHaveLength(0);
    await expect(generateDraft(await actorFor("resident39@example.test"), c.id)).rejects.toMatchObject({ status: 503 });
  });

  it("rejects reporting your own household or a household in another community", async () => {
    const reporter = await actorFor("resident39@example.test");
    const own = await household("House 39");
    const otherCommunity = await household("House 18", "DEMO-HILL");
    for (const target of [own, otherCommunity]) {
      await expect(
        createCase(reporter, { targetHouseholdId: target.id, category: "NOISE", occurredAt: new Date(Date.now() - HOUR), description: "Loud music late at night." }),
      ).rejects.toMatchObject({ status: 400, message: "We couldn't find a matching home in this community." });
    }
  });

  it("T16: another resident cannot draft, approve or send on someone else's case", async () => {
    const { c, draft } = await newParkingCase();
    const intruder = await actorFor("resident22@example.test");
    await expect(generateDraft(intruder, c.id)).rejects.toMatchObject({ status: 403 });
    await expect(approveDraft(intruder, c.id, { draftId: draft.id, textHash: draft.textHash, acknowledgeInferenceRisk: true })).rejects.toMatchObject({ status: 403 });
    await expect(sendNotice(intruder, c.id, { draftId: draft.id, idempotencyKey: "key-12345678" })).rejects.toMatchObject({ status: 403 });
  });
});
