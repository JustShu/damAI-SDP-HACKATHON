import { z } from "zod";
import { route } from "@/lib/api";
import { decide } from "@/lib/domain/review";

export const POST = route(z.object({ decision: z.string(), rationale: z.string(), policyRef: z.string() }), (actor, b, p) =>
  decide(actor, p.id, b),
);
