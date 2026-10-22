import { z } from "zod";
import { route } from "@/lib/api";
import { generateDraft } from "@/lib/domain/cases";

// Generate or regenerate the neutral notice; optional tone. Never sends anything.
export const POST = route(z.object({ tone: z.string().optional() }), (actor, b, p) => generateDraft(actor, p.id, { tone: b.tone }));
