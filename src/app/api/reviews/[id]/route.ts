import { route } from "@/lib/api";
import { getReviewDetail } from "@/lib/domain/review";

export const GET = route(null, (actor, _b, p) => getReviewDetail(actor, p.id));
