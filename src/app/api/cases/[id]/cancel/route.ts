import { route } from "@/lib/api";
import { cancelCase } from "@/lib/domain/cases";

export const POST = route(null, (actor, _b, p) => cancelCase(actor, p.id));
