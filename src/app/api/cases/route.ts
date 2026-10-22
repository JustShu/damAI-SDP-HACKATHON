import { z } from "zod";
import { route } from "@/lib/api";
import { createCase } from "@/lib/domain/cases";
import { listCasesForActor } from "@/lib/domain/views";

export const GET = route(null, (actor) => listCasesForActor(actor));

export const POST = route(
  z.object({
    targetHouseholdId: z.string().min(1),
    category: z.string(),
    occurredAt: z.string(),
    description: z.string(),
    safetyConcern: z.boolean().optional(),
    topic: z.string().optional(),
  }),
  async (actor, b) => {
    const c = await createCase(actor, { ...b, occurredAt: new Date(b.occurredAt) });
    return { id: c.id, state: c.state };
  },
);
