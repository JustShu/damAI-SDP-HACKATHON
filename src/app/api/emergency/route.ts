import { z } from "zod";
import { route } from "@/lib/api";
import { createAlert, listMyAlerts } from "@/lib/domain/emergency";

export const GET = route(null, (actor) => listMyAlerts(actor));

// Raise an urgent alert to community management.
export const POST = route(z.object({ type: z.string(), location: z.string(), details: z.string().optional() }), async (actor, b) => {
  const a = await createAlert(actor, b);
  return { id: a.id };
});
