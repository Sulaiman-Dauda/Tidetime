import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { env } from "./env";
import { randomToken, sha256 } from "./crypto";

// Secure cookies — and the __Host- prefix, which mandates HTTPS by spec — must
// be keyed off the actual scheme, not NODE_ENV: fresh self-hosted installs run
// production builds on plain http://<server-ip> until a reverse proxy is added,
// and browsers silently refuse Secure/__Host- cookies there, which logs users
// out on their first navigation.
const IS_HTTPS = env.appUrl.startsWith("https://");
const COOKIE_NAME = IS_HTTPS ? "__Host-tidetime_session" : "tidetime_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/** Create a new session for a user and set the cookie. */
export async function createSession(userId: number): Promise<void> {
  const token = randomToken(32);
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({ id, userId, expiresAt });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_HTTPS,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Revoke all of a user's sessions except the one making this request. */
export async function revokeOtherSessions(userId: number): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const currentId = token ? sha256(token) : null;
  await db
    .delete(sessions)
    .where(
      currentId
        ? and(eq(sessions.userId, userId), ne(sessions.id, currentId))
        : eq(sessions.userId, userId),
    );
}

/** Destroy the current session. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, sha256(token)));
    store.delete(COOKIE_NAME);
  }
}

/** Resolve the current user from the session cookie (cached per request). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const id = sha256(token);
  const row = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  if (row.length === 0) return null;
  const { sessions: session, users: user } = row[0];

  if (session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return user;
});

/** Throw-style guard for server components / actions that require auth. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

/** Throw-style guard for instance-admin-only actions. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}

/** Whether the instance has been set up yet (any user exists). Cached per request. */
export const hasAnyUser = cache(async (): Promise<boolean> => {
  const [row] = await db.select({ id: users.id }).from(users).limit(1);
  return Boolean(row);
});

export { COOKIE_NAME };
