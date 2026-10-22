import { route } from "@/lib/api";
import { getCaseView } from "@/lib/domain/views";

export const GET = route(null, (actor, _b, p) => getCaseView(actor, p.id));
