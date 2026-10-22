import { z } from "zod";
import { route } from "@/lib/api";
import { respond } from "@/lib/domain/cases";

export const POST = route(z.object({ responseType: z.string(), text: z.string().optional() }), async (actor, b, p) => {
  const { relay, findings } = await respond(actor, p.id, b);
  return { relayId: relay.id, status: relay.status, relayText: relay.relayText, findings };
});
