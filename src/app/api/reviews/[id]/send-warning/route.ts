import { z } from "zod";
import { route } from "@/lib/api";
import { sendWarningLetter } from "@/lib/domain/warnings";

// A manager sends the auto-drafted warning letter (after reviewing/editing it).
export const POST = route(z.object({ text: z.string(), rationale: z.string(), policyRef: z.string() }), (actor, b, p) =>
  sendWarningLetter(actor, p.id, b),
);
