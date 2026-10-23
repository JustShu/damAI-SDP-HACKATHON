import { z } from "zod";
import { route } from "@/lib/api";
import { actOnAlert } from "@/lib/domain/emergency";

// Manager response: ACKNOWLEDGE | DISPATCH (optional etaMinutes) | ON_SCENE | POLICE | RESOLVE.
export const POST = route(z.object({ action: z.string(), etaMinutes: z.number().optional(), note: z.string().optional() }), (actor, b, p) =>
  actOnAlert(actor, p.id, b),
);
