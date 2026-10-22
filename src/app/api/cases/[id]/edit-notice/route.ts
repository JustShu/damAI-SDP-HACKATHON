import { z } from "zod";
import { route } from "@/lib/api";
import { editDraft } from "@/lib/domain/cases";

export const POST = route(z.object({ text: z.string() }), async (actor, b, p) => {
  const d = await editDraft(actor, p.id, b.text);
  return { draftId: d.id };
});
