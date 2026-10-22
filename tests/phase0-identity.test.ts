import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { signInDemoAccount } from "@/lib/auth";
import { loadActor, requireResident } from "@/lib/actor";
import { actorFor, freshDemo, household } from "./helpers";

beforeEach(freshDemo);

describe("Phase 0 — households and identity", () => {
  it("T17: a house number alone is not a login", async () => {
    await expect(signInDemoAccount("House 18")).rejects.toMatchObject({ status: 401 });
    await expect(signInDemoAccount("18")).rejects.toMatchObject({ status: 401 });
  });

  it("T17: an invited but unverified person gets no resident access", async () => {
    const actor = await actorFor("invited41@example.test");
    expect(actor.household).toBeNull();
    expect(() => requireResident(actor)).toThrow();
  });

  it("verified residents are linked to exactly their household", async () => {
    const actor = await actorFor("resident39@example.test");
    expect(actor.household?.label).toBe("House 39");
    expect(actor.managerCommunityIds).toEqual([]);
  });

  it("the same unit label in two communities does not collide", async () => {
    const a = await household("House 18", "DEMO-PARK");
    const b = await household("House 18", "DEMO-HILL");
    expect(a.id).not.toBe(b.id);
    await expect(
      prisma.household.create({ data: { communityId: a.communityId, block: "A", unit: "18", label: "dup" } }),
    ).rejects.toThrow();
  });

  it("suspended membership removes access", async () => {
    const actor = await actorFor("resident18@example.test");
    await prisma.membership.updateMany({ where: { userId: actor.userId }, data: { status: "SUSPENDED" } });
    expect((await loadActor(actor.userId)).household).toBeNull();
  });

  it("unknown sessions are unauthenticated", async () => {
    await expect(loadActor(undefined)).rejects.toMatchObject({ status: 401 });
    await expect(loadActor("not-a-user")).rejects.toMatchObject({ status: 401 });
  });
});
