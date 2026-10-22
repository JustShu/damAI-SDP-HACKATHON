import { route } from "@/lib/api";
import { requireAnyManager } from "@/lib/actor";
import { prisma } from "@/lib/db";
import { seed } from "@/lib/seed";

// Demo-only: restores the synthetic seed data for a fresh rehearsal.
// Seeded users are recreated with new IDs, so everyone is signed out.
export const POST = route(null, async (actor) => {
  requireAnyManager(actor);
  await seed(prisma);
});
