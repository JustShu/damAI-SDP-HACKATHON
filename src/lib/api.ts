import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { Actor } from "./actor";
import { AppError, badRequest } from "./errors";
import { currentActor } from "./session";

type Ctx = { params: Promise<Record<string, string>> };

// Wraps a route: resolves the signed-in actor from the session cookie (never
// from the request body), parses the body with a schema, and maps errors.
export function route<T>(
  schema: ZodType<T> | null,
  fn: (actor: Actor, body: T, params: Record<string, string>) => Promise<unknown>,
) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const actor = await currentActor();
      let body = undefined as T;
      if (schema) {
        const json = await req.json().catch(() => {
          throw badRequest("Invalid request body.");
        });
        body = schema.parse(json);
      }
      const result = await fn(actor, body, await ctx.params);
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
      console.error("Unhandled API error", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "Something went wrong. Nothing was sent." }, { status: 500 });
    }
  };
}
