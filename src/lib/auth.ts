import { prisma } from "./db";
import { unauthenticated } from "./errors";

// Demo sign-in: only pre-seeded synthetic accounts can sign in, by account
// email. There is no self-registration, and a house number is never accepted.
export async function signInDemoAccount(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.status !== "ACTIVE" || !user.email.endsWith("@example.test")) {
    throw unauthenticated();
  }
  return user.id;
}

export async function listDemoAccounts() {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    include: { memberships: { include: { household: { include: { community: true } } } }, managerOf: { include: { community: true } } },
    orderBy: { email: "asc" },
  });
  return users.map((u) => {
    const m = u.memberships[0];
    return {
      email: u.email,
      displayName: u.displayName,
      role: u.managerOf.length ? "Manager" : "Resident",
      household: m ? `${m.household.label}, ${m.household.community.name}` : null,
      membershipStatus: m?.status ?? null,
      community: u.managerOf[0]?.community.name ?? m?.household.community.name ?? "",
    };
  });
}
