import { z } from "zod";
import { route } from "@/lib/api";
import { updateDescription } from "@/lib/domain/cases";

export const POST = route(z.object({ description: z.string() }), (actor, b, p) => updateDescription(actor, p.id, b.description));
