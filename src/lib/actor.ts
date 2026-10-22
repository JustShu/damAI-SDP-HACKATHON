import { prisma } from "./db";
import { forbidden, unauthenticated } from "./errors";

// Everything a service needs to know about who is acting. Always loaded from
// the database on the server — never built from client-supplied role or house IDs.
export type Actor = {
  userId: string;
  displayName: string;
  household: { id: string; label: string; communityId: string } | null;
  managerCommunityIds: string[];
};

export async function loadActor(userId: string | undefined | null): Promise<Actor> {
  if (!userId) throw unauthenticated();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: { where: { status: "VERIFIED" }, include: { household: true } },
      managerOf: true,
    },
  });
  if (!user || user.status !== "ACTIVE") throw unauthenticated();

  // Only a verified membership of an active household counts.
  const m = user.memberships.find((x) => x.household.status === "ACTIVE");
  return {
    userId: user.id,
    displayName: user.displayName,
    household: m
      ? { id: m.household.id, label: m.household.label, communityId: m.household.communityId }
      : null,
    managerCommunityIds: user.managerOf.map((a) => a.communityId),
  };
}

export function requireResident(actor: Actor) {
  if (!actor.household) throw forbidden();
  return actor.household;
}

export function requireManagerOf(actor: Actor, communityId: string) {
  if (!actor.managerCommunityIds.includes(communityId)) throw forbidden();
}

export function requireAnyManager(actor: Actor) {
  if (actor.managerCommunityIds.length === 0) throw forbidden();
}
