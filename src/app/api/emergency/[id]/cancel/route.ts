import { route } from "@/lib/api";
import { cancelAlert } from "@/lib/domain/emergency";

// The reporter cancels a false alarm.
export const POST = route(null, (actor, _b, p) => cancelAlert(actor, p.id));
