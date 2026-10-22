import { z } from "zod";
import { route } from "@/lib/api";
import { requireAnyManager } from "@/lib/actor";
import { getOffsetMs, now, setOffsetMs } from "@/lib/clock";
import { audit } from "@/lib/audit";
import { runPolicyChecks } from "@/lib/domain/policy";

// Demo-only: moves the app's clock forward so time-based rules can be shown live.
export const POST = route(z.object({ advanceHours: z.number().min(0).max(24 * 30).optional(), reset: z.boolean().optional() }), async (actor, b) => {
  requireAnyManager(actor);
  await setOffsetMs(b.reset ? 0 : (await getOffsetMs()) + (b.advanceHours ?? 0) * 3600_000);
  const at = await now();
  await audit(actor.userId, "DemoClockChanged", "setting", "clock", at, { advanceHours: b.advanceHours ?? 0, reset: !!b.reset });
  await runPolicyChecks(at);
  return { now: at.toISOString() };
});
