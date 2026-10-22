import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { loadActor } from "./actor";

type SessionData = { userId?: string };

function sessionOptions() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters (see .env.example)");
  }
  return {
    password,
    cookieName: "anm_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export async function currentActor() {
  const session = await getSession();
  return loadActor(session.userId);
}

// For pages: returns null instead of throwing when signed out.
export async function currentActorOrNull() {
  try {
    return await currentActor();
  } catch {
    return null;
  }
}
