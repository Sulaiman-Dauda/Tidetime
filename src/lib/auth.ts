import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { env } from "./env";
import { randomToken, sha256 } from "./crypto";

// Secure cookies — and the __Host- prefix, which mandates HTTPS by spec — are
// decided per request from the actual scheme, never from NODE_ENV: a fresh
// self-hosted install is browsed over plain http://<server-ip>, while the same
// instance may simultaneously serve https://<custom-domain> through the
// bundled Caddy proxy. Each origin gets the strongest cookie it can hold, and
// reads accept both names so neither origin invalidates the other.
const SECURE_COOKIE = "__Host-tidetime_session";
const PLAIN_COOKIE = "tidetime_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/** Whether the current request arrived over HTTPS (directly or via a proxy). */
async function requestIsHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return env.appUrl.startsWith("https://");
}

/** The session token from whichever cookie name is present. */
async function readSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SECURE_COOKIE)?.value ?? store.get(PLAIN_COOKIE)?.value;
}

/** Create a new session for a user and set the cookie. */
export async function createSession(userId: number): Promise<void> {
  const token = randomToken(32);
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({ id, userId, expiresAt });

  const isHttps = await requestIsHttps();
  const store = await cookies();
  store.set(isHttps ? SECURE_COOKIE : PLAIN_COOKIE, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Revoke all of a user's sessions except the one making this request. */
export async function revokeOtherSessions(userId: number): Promise<void> {
  const token = await readSessionToken();
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
  const token = await readSessionToken();
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, sha256(token)));
    const store = await cookies();
    store.delete(SECURE_COOKIE);
    store.delete(PLAIN_COOKIE);
  }
}

/** Resolve the current user from the session cookie (cached per request). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await readSessionToken();
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
