import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { approveDraft, confirmRelay, confirmStatus, createCase, requestReview, respond, sendNotice } from "@/lib/domain/cases";
import { actorFor, freshDemo, household, HOUR } from "./helpers";

beforeEach(freshDemo);

// Runs the reporter half of the happy path and returns a delivered case.
async function deliveredParkingCase() {
  const reporter = await actorFor("resident39@example.test");
  const recipient = await actorFor("resident18@example.test");
  const c = await createCase(reporter, {
    targetHouseholdId: (await household("House 18")).id,
    category: "PARKING",
    occurredAt: new Date(Date.now() - 5 * HOUR),
    description: "House 18 keeps blocking MY gate, so rude!",
  });
  const draft = await prisma.noticeDraft.findFirstOrThrow({ where: { caseId: c.id } });
  await approveDraft(reporter, c.id, { draftId: draft.id, textHash: draft.textHash, acknowledgeInferenceRisk: true });
  await sendNotice(reporter, c.id, { draftId: draft.id, idempotencyKey: `k-${c.id}` });
  return { reporter, recipient, c };
}

const stream = (caseId: string, side: string) => prisma.message.findMany({ where: { caseId, side }, orderBy: { createdAt: "asc" } });

describe("Phase 2 — recipient response and resolution", () => {
  it("T06: a commitment is relayed neutrally, and only after the recipient confirms it", async () => {
    const { reporter, recipient, c } = await deliveredParkingCase();
    const { relay } = await respond(recipient, c.id, { responseType: "COMMIT", text: "Sorry, I'm Aisyah, I'll make sure entrances stay clear." });
    expect(relay.status).toBe("PREVIEW");
    expect((await stream(c.id, "REPORTER")).some((m) => m.kind === "RELAY")).toBe(false);

    await confirmRelay(recipient, c.id, { relayId: relay.id });
    const reporterSide = await stream(c.id, "REPORTER");
    const relayed = reporterSide.find((m) => m.kind === "RELAY")!;
    expect(relayed.body).toBe("The other household apologised and acknowledged the concern. They said they'll make sure entrances stay clear.");
    // The recipient's verbatim reply stays on their side only.
    expect(reporterSide.map((m) => m.body).join(" ")).not.toContain("Aisyah");
    expect((await prisma.case.findUniqueOrThrow({ where: { id: c.id } })).state).toBe("ASSISTED_RESOLUTION");
    expect(reporter.userId).not.toBe(recipient.userId);
  });

  it("a recipient's edited summary is privacy-checked before sharing", async () => {
    const { recipient, c } = await deliveredParkingCase();
    const { relay } = await respond(recipient, c.id, { responseType: "CLARIFY", text: "Our driver parked there briefly." });
    await expect(
      confirmRelay(recipient, c.id, { relayId: relay.id, relayText: "Nur Aisyah from House 18 says call 012-555 1234." }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("abusive replies are held for a person and never forwarded", async () => {
    const { recipient, c } = await deliveredParkingCase();
    const { relay } = await respond(recipient, c.id, { responseType: "DISPUTE", text: "Mind your own business, idiot." });
    expect(relay.status).toBe("HELD");
    expect((await stream(c.id, "REPORTER")).some((m) => m.body.includes("idiot"))).toBe(false);
    expect(await prisma.reviewFlag.count({ where: { caseId: c.id, reason: "ABUSE" } })).toBe(1);
  });

  it("T07: a dispute is not treated as a proven violation and can go to fair review", async () => {
    const { reporter, recipient, c } = await deliveredParkingCase();
    const { relay } = await respond(recipient, c.id, { responseType: "DISPUTE", text: "That wasn't our car." });
    await confirmRelay(recipient, c.id, { relayId: relay.id });
    await confirmStatus(reporter, c.id, { status: "UNRESOLVED" });

    const after = await prisma.case.findUniqueOrThrow({ where: { id: c.id }, include: { incident: true } });
    expect(after.disputed).toBe(true);
    expect(after.incident!.status).toBe("DISPUTED"); // not QUALIFYING_UNRESOLVED

    await requestReview(recipient, c.id, "We'd like a manager to look at this.");
    expect(await prisma.reviewFlag.count({ where: { caseId: c.id, reason: "REVIEW_REQUESTED" } })).toBe(1);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: c.id } })).state).toBe("HUMAN_REVIEW");
  });

  it("T08: confirming resolution records an audit event and adds no strike", async () => {
    const { reporter, recipient, c } = await deliveredParkingCase();
    const { relay } = await respond(recipient, c.id, { responseType: "ACKNOWLEDGE" });
    await confirmRelay(recipient, c.id, { relayId: relay.id });
    await confirmStatus(reporter, c.id, { status: "RESOLVED" });

    const after = await prisma.case.findUniqueOrThrow({ where: { id: c.id }, include: { incident: true } });
    expect(after.state).toBe("RESOLVED");
    expect(after.incident!.status).toBe("RESOLVED");
    expect(await prisma.auditEvent.count({ where: { action: "CaseResolved", resourceId: c.id } })).toBe(1);
    expect(await prisma.reviewFlag.count({ where: { caseId: c.id } })).toBe(0);
  });

  it("only the reporter can confirm the outcome; only the recipient household can respond", async () => {
    const { reporter, recipient, c } = await deliveredParkingCase();
    await expect(confirmStatus(recipient, c.id, { status: "RESOLVED" })).rejects.toMatchObject({ status: 403 });
    await expect(respond(reporter, c.id, { responseType: "ACKNOWLEDGE" })).rejects.toMatchObject({ status: 403 });
    const outsider = await actorFor("resident22@example.test");
    await expect(requestReview(outsider, c.id)).rejects.toMatchObject({ status: 403 });
  });
});
