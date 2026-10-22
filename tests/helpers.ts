import { prisma } from "@/lib/db";
import { loadActor } from "@/lib/actor";
import { seed } from "@/lib/seed";
import { setOffsetMs } from "@/lib/clock";

export async function freshDemo() {
  await seed(prisma);
  await setOffsetMs(0);
}

export async function actorFor(email: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return loadActor(u.id);
}

export async function household(label: string, communityCode = "DEMO-PARK") {
  return prisma.household.findFirstOrThrow({ where: { label, community: { code: communityCode } } });
}

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;
