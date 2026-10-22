import { z } from "zod";
import { route } from "@/lib/api";
import { confirmStatus } from "@/lib/domain/cases";

export const POST = route(z.object({ status: z.string(), note: z.string().optional() }), (actor, b, p) =>
  confirmStatus(actor, p.id, b),
);
