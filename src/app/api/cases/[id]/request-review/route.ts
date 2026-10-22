import { z } from "zod";
import { route } from "@/lib/api";
import { requestReview } from "@/lib/domain/cases";

export const POST = route(z.object({ note: z.string().max(500).optional() }), (actor, b, p) => requestReview(actor, p.id, b.note));
