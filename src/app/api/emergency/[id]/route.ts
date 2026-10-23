import { route } from "@/lib/api";
import { getAlert } from "@/lib/domain/emergency";

// The reporter or a community manager can read an alert and its updates.
export const GET = route(null, (actor, _b, p) => getAlert(actor, p.id));
