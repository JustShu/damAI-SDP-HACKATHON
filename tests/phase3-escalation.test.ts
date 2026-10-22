import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { loadActor } from "@/lib/actor";
import { approveDraft, confirmRelay, confirmStatus, createCase, respond, sendNotice } from "@/lib/domain/cases";
import { runPolicyChecks } from "@/lib/domain/policy";
import { decide, getReviewDetail, listQueue, revealRestricted } from "@/lib/domain/review";
import { actorFor, DAY, freshDemo, household, HOUR } from "./helpers";

beforeEach(freshDemo);

// The seeded case awaiting House 39's confirmation: the 3rd distinct noise incident.
async function seededThirdNoiseCase() {
  return prisma.case.findFirstOrThrow({ where: { category: "NOISE", state: "ASSISTED_RESOLUTION" } });
}

async function deliver(reporterEmail: string, target: string, category: string, occurredAt: Date, description: string) {
  const reporter = await actorFor(reporterEmail);
  const c = await createCase(reporter, { targetHouseholdId: (await household(target)).id, category, occurredAt, description });
  const d = await prisma.noticeDraft.findFirstOrThrow({ where: { caseId: c.id } });
  await approveDraft(reporter, c.id, { draftId: d.id, textHash: d.textHash, acknowledgeInferenceRisk: true });
  await sendNotice(reporter, c.id, { draftId: d.id, idempotencyKey: `k-${c.id}` });
  return { reporter, c };
}

const repeatFlags = () => prisma.reviewFlag.count({ where: { reason: "REPEAT_UNRESOLVED" } });

describe("Phase 3 — incident counting and escalation", () => {
  it("T09: three reports of the same event are one incident, not three", async () => {
    const at = new Date(Date.now() - 20 * HOUR);
    const cases = [];
    for (const email of ["resident39@example.test", "resident22@example.test", "resident25@example.test"]) {
      cases.push((await deliver(email, "House 18", "PARKING", new Date(at.getTime() + 20 * 60_000 * cases.length), "Car blocking the entrance all evening.")).c);
    }
    expect(new Set(cases.map((c) => c.incidentId)).size).toBe(1);

    for (const c of cases) {
      const reporter = await loadActor(c.reporterUserId);
      await confirmStatus(reporter, c.id, { status: "UNRESOLVED" });
    }
    const qualifying = await prisma.incident.count({ where: { category: "PARKING", status: "QUALIFYING_UNRESOLVED" } });
    expect(qualifying).toBe(1);
    expect(await repeatFlags()).toBe(0);
  });

  it("T10: the third distinct unresolved noise incident in 30 days raises a review flag only", async () => {
    const c = await seededThirdNoiseCase();
    await confirmStatus(await actorFor("resident39@example.test"), c.id, { status: "UNRESOLVED" });

    expect(await repeatFlags()).toBe(1);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: c.id } })).state).toBe("HUMAN_REVIEW");
    // No automatic warning or any other management action.
    expect(await prisma.managementAction.count()).toBe(0);
    const recipientSide = await prisma.message.findMany({ where: { caseId: c.id, side: "RECIPIENT" } });
    expect(recipientSide.map((m) => m.body).join(" ")).not.toMatch(/warning|strike|penalt|fine/i);
  });

  it("T11: two noise incidents and one parking incident do not meet the threshold", async () => {
    const { reporter, c } = await deliver("resident25@example.test", "House 18", "PARKING", new Date(Date.now() - 3 * HOUR), "Car blocking the entrance again.");
    await confirmStatus(reporter, c.id, { status: "UNRESOLVED" });
    expect(await repeatFlags()).toBe(0);
  });

  it("T12: incidents older than 30 days don't count toward the threshold", async () => {
    // Move the oldest seeded noise incident outside the rolling window.
    const oldest = await prisma.incident.findFirstOrThrow({ where: { category: "NOISE" }, orderBy: { occurredAt: "asc" } });
    await prisma.incident.update({ where: { id: oldest.id }, data: { occurredAt: new Date(Date.now() - 40 * DAY) } });
    const c = await seededThirdNoiseCase();
    await confirmStatus(await actorFor("resident39@example.test"), c.id, { status: "UNRESOLVED" });
    expect(await repeatFlags()).toBe(0);
  });

  it("T13 + T20: a case unresolved for 7 days gets exactly one overdue flag", async () => {
    const later = new Date(Date.now() + 1 * DAY + HOUR);
    await runPolicyChecks(later);
    await runPolicyChecks(later);
    const pet = await prisma.case.findFirstOrThrow({ where: { category: "PET" } });
    expect(await prisma.reviewFlag.count({ where: { caseId: pet.id, reason: "OVERDUE" } })).toBe(1);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: pet.id } })).state).toBe("HUMAN_REVIEW");
  });

  it("T14: an unanswered notice gets one polite reminder after 72h — not a guilt finding", async () => {
    const { c } = await deliver("resident39@example.test", "House 22", "NOISE", new Date(Date.now() - 2 * HOUR), "Loud music after midnight.");
    await runPolicyChecks(new Date(Date.now() + 71 * HOUR));
    expect(await prisma.message.count({ where: { caseId: c.id, kind: "REMINDER" } })).toBe(0);
    await runPolicyChecks(new Date(Date.now() + 73 * HOUR));
    await runPolicyChecks(new Date(Date.now() + 74 * HOUR));
    const reminders = await prisma.message.findMany({ where: { caseId: c.id, kind: "REMINDER" } });
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).toMatch(/not replying isn't treated as agreement/);
    const after = await prisma.case.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.state).toBe("NOTICE_SENT");
    expect(await prisma.reviewFlag.count({ where: { caseId: c.id } })).toBe(0);
  });

  it("a recipient replying again takes the incident out of the qualifying count", async () => {
    const c = await seededThirdNoiseCase();
    await confirmStatus(await actorFor("resident39@example.test"), c.id, { status: "UNRESOLVED" });
    const qualifying = await prisma.incident.count({ where: { status: "QUALIFYING_UNRESOLVED" } });
    expect(qualifying).toBe(3);
    // House 18 replies on an earlier (non-flagged) case, which re-opens assisted resolution there.
    const daniel = await actorFor("resident39@example.test");
    const earlier = await prisma.case.findFirstOrThrow({ where: { category: "NOISE", state: "UNRESOLVED", reporterUserId: daniel.userId } });
    const recipient = await actorFor("resident18@example.test");
    const { relay } = await respond(recipient, earlier.id, { responseType: "COMMIT", text: "We'll keep it down." });
    await confirmRelay(recipient, earlier.id, { relayId: relay.id });
    expect((await prisma.incident.findUniqueOrThrow({ where: { id: earlier.incidentId! } })).status).not.toBe("QUALIFYING_UNRESOLVED");
  });
});

describe("Phase 3 — management review", () => {
  async function flagged() {
    const c = await seededThirdNoiseCase();
    await confirmStatus(await actorFor("resident39@example.test"), c.id, { status: "UNRESOLVED" });
    const flag = await prisma.reviewFlag.findFirstOrThrow({ where: { reason: "REPEAT_UNRESOLVED" } });
    return { c, flag, manager: await actorFor("manager@example.test") };
  }

  it("T19: residents cannot see the queue or issue a warning", async () => {
    const { flag } = await flagged();
    for (const email of ["resident39@example.test", "resident18@example.test"]) {
      const resident = await actorFor(email);
      await expect(listQueue(resident)).rejects.toMatchObject({ status: 403 });
      await expect(getReviewDetail(resident, flag.id)).rejects.toMatchObject({ status: 403 });
      await expect(decide(resident, flag.id, { decision: "FORMAL_WARNING", rationale: "Repeated noise.", policyRef: "Rule 1" })).rejects.toMatchObject({ status: 403 });
    }
  });

  it("a manager of another community cannot access this queue item", async () => {
    const { flag } = await flagged();
    const hill = await prisma.community.findUniqueOrThrow({ where: { code: "DEMO-HILL" } });
    const other = await prisma.user.create({ data: { email: "hillmanager@example.test", displayName: "Hill manager", managerOf: { create: { communityId: hill.id } } } });
    const actor = await loadActor(other.id);
    expect(await listQueue(actor)).toHaveLength(0);
    await expect(getReviewDetail(actor, flag.id)).rejects.toMatchObject({ status: 403 });
  });

  it("detail shows separate incidents but hides reporter identity until a logged reveal", async () => {
    const { flag, manager } = await flagged();
    const detail = await getReviewDetail(manager, flag.id);
    expect(detail.incidents.filter((i) => i.status === "QUALIFYING_UNRESOLVED")).toHaveLength(3);
    expect(detail.incidents.find((i) => i.reports === 2)).toBeTruthy(); // the duplicate-reported incident
    expect(JSON.stringify(detail)).not.toMatch(/Daniel|House 39/);

    await expect(revealRestricted(manager, flag.id, "x")).rejects.toMatchObject({ status: 400 });
    const revealed = await revealRestricted(manager, flag.id, "Need to contact reporter for more context.");
    expect(revealed.reporterHousehold).toBe("House 39");
    expect(await prisma.auditEvent.count({ where: { action: "SensitiveIdentityAccessed" } })).toBe(1);
  });

  it("each decision records reviewer, rationale and policy reference", async () => {
    const { c, flag, manager } = await flagged();
    await expect(decide(manager, flag.id, { decision: "FORMAL_WARNING", rationale: "", policyRef: "" })).rejects.toMatchObject({ status: 400 });
    await decide(manager, flag.id, { decision: "FORMAL_WARNING", rationale: "Three unresolved late-night noise incidents.", policyRef: "DEMO-PARK house rules §4 (synthetic)" });

    const action = await prisma.managementAction.findFirstOrThrow({ where: { caseId: c.id } });
    expect(action).toMatchObject({ reviewerId: manager.userId, decision: "FORMAL_WARNING", policyRef: "DEMO-PARK house rules §4 (synthetic)" });
    expect(await prisma.auditEvent.count({ where: { action: "ManagementWarningIssued" } })).toBe(1);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: c.id } })).state).toBe("CLOSED");
    await expect(decide(manager, flag.id, { decision: "CLOSE_RESOLVED", rationale: "Second attempt here.", policyRef: "x-1" })).rejects.toMatchObject({ status: 409 });
  });

  it("closing as unsubstantiated stops the incident from counting", async () => {
    const { c, flag, manager } = await flagged();
    await decide(manager, flag.id, { decision: "CLOSE_UNSUBSTANTIATED", rationale: "Not enough information to support it.", policyRef: "Review guideline 2" });
    expect((await prisma.incident.findUniqueOrThrow({ where: { id: c.incidentId! } })).status).toBe("DISMISSED");
  });
});
