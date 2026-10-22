import { z } from "zod";
import { route } from "@/lib/api";
import { sendNotice } from "@/lib/domain/cases";

export const POST = route(z.object({ draftId: z.string(), idempotencyKey: z.string() }), async (actor, b, p) => {
  await sendNotice(actor, p.id, b);
});
