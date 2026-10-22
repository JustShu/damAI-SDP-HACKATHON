import { z } from "zod";
import { route } from "@/lib/api";
import { approveDraft } from "@/lib/domain/cases";

export const POST = route(
  z.object({ draftId: z.string(), textHash: z.string(), acknowledgeInferenceRisk: z.boolean() }),
  async (actor, b, p) => {
    await approveDraft(actor, p.id, b);
  },
);
