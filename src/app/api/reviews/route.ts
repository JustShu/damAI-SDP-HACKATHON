import { route } from "@/lib/api";
import { listQueue } from "@/lib/domain/review";

export const GET = route(null, (actor) => listQueue(actor));
