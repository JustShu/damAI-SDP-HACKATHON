import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { confirmStatus } from "@/lib/domain/cases";
import { decide, listQueue } from "@/lib/domain/review";
import { getHouseholdReport, sendWarningLetter } from "@/lib/domain/warnings";
import { actOnAlert, cancelAlert, createAlert, getAlert, listAlertsForManager, listMyAlerts } from "@/lib/domain/emergency";
import { actorFor, freshDemo } from "./helpers";

beforeEach(freshDemo);

const MANAGER = "manager@example.test";
const DANIEL = "resident39@example.test";

/** Daniel marks the seeded noise case "not resolved": House 18's 3rd qualifying noise incident. */
async function reachRepeatThreshold() {
  const daniel = await actorFor(DANIEL);
  const c = await prisma.case.findFirstOrThrow({ where: { category: "NOISE", state: "ASSISTED_RESOLUTION" } });
  await confirmStatus(daniel, c.id, { status: "UNRESOLVED" });
  return prisma.reviewFlag.findFirstOrThrow({ where: { reason: "REPEAT_UNRESOLVED" } });
}

describe("Phase 6 — warning letters", () => {
  it("drafts a factual letter when a household reaches 3 incidents, but sends nothing", async () => {
    const flag = await reachRepeatThreshold();
    const letter = await prisma.warningLetter.findUniqueOrThrow({ where: { flagId: flag.id } });
    expect(letter.status).toBe("DRAFT");
    expect(letter.draftText).toMatch(/Dear residents of House 18/);
    expect(letter.draftText).toMatch(/3 separate occasions/);
    expect(letter.draftText).toContain("[community rule]");
    // Never says who reported.
    expect(letter.draftText).not.toMatch(/Daniel|Priya|Hafiz|House 39|House 22|House 25/);
    // Not delivered until a manager sends it.
    expect(await prisma.message.count({ where: { side: "RECIPIENT", kind: "MANAGEMENT" } })).toBe(0);

    const queue = await listQueue(await actorFor(MANAGER));
    expect(queue.find((f) => f.id === flag.id)?.letterReady).toBe(true);
  });

  it("gives management a household report without revealing reporters", async () => {
    const flag = await reachRepeatThreshold();
    const report = await getHouseholdReport(await actorFor(MANAGER), flag.id);
    expect(report.household.label).toBe("House 18");
    expect(report.qualifying).toHaveLength(3);
    expect(report.letter?.status).toBe("DRAFT");
    expect(JSON.stringify(report)).not.toMatch(/Daniel|Priya|Hafiz|House 39|House 22|House 25/);
    await expect(getHouseholdReport(await actorFor(DANIEL), flag.id)).rejects.toMatchObject({ status: 403 });
  });

  it("only a manager can send it, with a named rule; it reaches House 18 once", async () => {
    const flag = await reachRepeatThreshold();
    const letter = await prisma.warningLetter.findUniqueOrThrow({ where: { flagId: flag.id } });
    const send = { text: letter.draftText, rationale: "Third unresolved late-night noise incident this month.", policyRef: "House rules s.4 (quiet hours)" };

    await expect(sendWarningLetter(await actorFor(DANIEL), flag.id, send)).rejects.toMatchObject({ status: 403 });
    await expect(sendWarningLetter(await actorFor(MANAGER), flag.id, { ...send, policyRef: "" })).rejects.toMatchObject({ status: 400 });

    await sendWarningLetter(await actorFor(MANAGER), flag.id, send);
    const delivered = await prisma.message.findFirstOrThrow({ where: { caseId: flag.caseId, side: "RECIPIENT", kind: "MANAGEMENT" } });
    expect(delivered.body).toContain("formal warning under House rules s.4 (quiet hours)");
    expect(delivered.body).not.toContain("[community rule]");
    expect((await prisma.warningLetter.findUniqueOrThrow({ where: { id: letter.id } })).status).toBe("SENT");
    expect((await prisma.reviewFlag.findUniqueOrThrow({ where: { id: flag.id } })).status).toBe("DECIDED");
    expect(await prisma.managementAction.count({ where: { flagId: flag.id, decision: "FORMAL_WARNING" } })).toBe(1);

    await expect(sendWarningLetter(await actorFor(MANAGER), flag.id, send)).rejects.toMatchObject({ status: 409 });
  });

  it("choosing a different decision discards the draft", async () => {
    const flag = await reachRepeatThreshold();
    await decide(await actorFor(MANAGER), flag.id, { decision: "CLOSE_UNSUBSTANTIATED", rationale: "Not enough to support a warning.", policyRef: "Review guidelines" });
    expect((await prisma.warningLetter.findUniqueOrThrow({ where: { flagId: flag.id } })).status).toBe("DISCARDED");
  });
});

describe("Phase 6 — urgent alerts and security dispatch", () => {
  const raise = async () =>
    createAlert(await actorFor(DANIEL), { type: "FIGHT", location: "Playground near Jalan 3", details: "Two men fighting, one is bleeding." });

  it("goes straight to management, who can dispatch security; the reporter sees each update", async () => {
    const a = await raise();
    const manager = await actorFor(MANAGER);
    expect((await listAlertsForManager(manager)).find((x) => x.id === a.id)).toMatchObject({ status: "NEW", reporterHousehold: "House 39" });

    await actOnAlert(manager, a.id, { action: "DISPATCH", etaMinutes: 5 });
    const seen = await getAlert(await actorFor(DANIEL), a.id);
    expect(seen.status).toBe("DISPATCHED");
    expect(seen.updates.at(-1)?.body).toMatch(/Security is on the way, expected in about 5 minutes/);

    await actOnAlert(manager, a.id, { action: "ON_SCENE" });
    await actOnAlert(manager, a.id, { action: "RESOLVE", note: "Both parties separated, no injuries needing hospital." });
    const done = await getAlert(await actorFor(DANIEL), a.id);
    expect(done.open).toBe(false);
    expect(done.updates.map((u) => u.status)).toEqual(["NEW", "DISPATCHED", "ON_SCENE", "RESOLVED"]);
    await expect(actOnAlert(manager, a.id, { action: "DISPATCH" })).rejects.toMatchObject({ status: 409 });
  });

  it("is private to the reporter and management", async () => {
    const a = await raise();
    await expect(getAlert(await actorFor("resident18@example.test"), a.id)).rejects.toMatchObject({ status: 403 });
    await expect(actOnAlert(await actorFor("resident18@example.test"), a.id, { action: "RESOLVE" })).rejects.toMatchObject({ status: 403 });
    // The reporter's identity is shown to management (so security can reach them), not to other residents.
    expect(await getAlert(await actorFor(MANAGER), a.id)).toMatchObject({ role: "MANAGER", reporterHousehold: "House 39" });
    // Audit keeps no free-text details.
    expect(JSON.stringify(await prisma.auditEvent.findMany({ where: { resourceId: a.id } }))).not.toContain("bleeding");
  });

  it("validates input, lets the reporter cancel, and limits repeated alerts", async () => {
    const daniel = await actorFor(DANIEL);
    await expect(createAlert(daniel, { type: "PARTY", location: "Jalan 3" })).rejects.toMatchObject({ status: 400 });
    await expect(createAlert(daniel, { type: "FIGHT", location: "" })).rejects.toMatchObject({ status: 400 });

    const a = await raise();
    await cancelAlert(daniel, a.id);
    expect((await listMyAlerts(daniel)).find((x) => x.id === a.id)?.status).toBe("CANCELLED");

    for (let i = 0; i < 4; i++) await raise();
    await expect(raise()).rejects.toMatchObject({ status: 429 });
  });
});
