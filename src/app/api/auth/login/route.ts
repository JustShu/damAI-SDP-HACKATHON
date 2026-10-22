import { NextResponse } from "next/server";
import { z } from "zod";
import { signInDemoAccount } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email } = z.object({ email: z.string().max(200) }).parse(await req.json());
    const session = await getSession();
    session.userId = await signInDemoAccount(email);
    await session.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 400;
    return NextResponse.json({ error: "That sign-in didn't work." }, { status });
  }
}
