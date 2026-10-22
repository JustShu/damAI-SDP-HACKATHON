import { z } from "zod";
import { route } from "@/lib/api";
import { confirmRelay } from "@/lib/domain/cases";

export const POST = route(z.object({ relayId: z.string(), relayText: z.string().optional() }), (actor, b, p) =>
  confirmRelay(actor, p.id, b),
);
