import { z } from "zod";
import { route } from "@/lib/api";
import { revealRestricted } from "@/lib/domain/review";

export const POST = route(z.object({ reason: z.string() }), (actor, b, p) => revealRestricted(actor, p.id, b.reason));
