import "server-only";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys, users, type User } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Authenticate a REST API request via Bearer token or `?apiKey=` param.
 * Keys are stored only as sha-256 hashes.
 */
export async function authenticateApiKey(req: NextRequest): Promise<User | null> {
  const header = req.headers.get("authorization");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  const key = bearer ?? req.nextUrl.searchParams.get("apiKey");
  if (!key) return null;

  const hashed = sha256(key);
  const [row] = await db
    .select({ key: apiKeys, user: users })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(eq(apiKeys.hashedKey, hashed))
    .limit(1);

  if (!row) return null;
  if (row.key.expiresAt && row.key.expiresAt.getTime() < Date.now()) return null;

  // Best-effort last-used tracking (don't block the response).
  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.key.id));

  return row.user;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** 429 response with an optional Retry-After header. */
export function tooManyRequests(retryAfterMs = 0) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: retryAfterMs ? { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } : undefined,
    },
  );
}

/**
 * Per-API-key rate limit. Returns a 429 NextResponse when the caller has exceeded
 * the window, otherwise null. Default: 120 requests/minute per key owner.
 */
export function enforceApiRateLimit(user: User, limit = 120, windowMs = 60_000): NextResponse | null {
  const res = checkRateLimit(`api:${user.id}`, { limit, windowMs });
  return res.ok ? null : tooManyRequests(res.retryAfterMs);
}

export interface PageParams {
  limit: number;
  offset: number;
}

/**
 * Parse `?limit=&offset=` (or `?page=`) into safe, capped pagination params.
 * Defaults: limit 50, max 200. Never returns negative values.
 */
export function parsePage(req: NextRequest, defaultLimit = 50, maxLimit = 200): PageParams {
  const sp = req.nextUrl.searchParams;
  const rawLimit = Number(sp.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;

  const offsetParam = sp.get("offset");
  if (offsetParam !== null) {
    const rawOffset = Number(offsetParam);
    if (Number.isFinite(rawOffset) && rawOffset >= 0) return { limit, offset: Math.floor(rawOffset) };
  }

  const pageParam = sp.get("page");
  if (pageParam !== null) {
    const rawPage = Number(pageParam);
    if (Number.isFinite(rawPage) && rawPage > 1) return { limit, offset: (Math.floor(rawPage) - 1) * limit };
  }

  return { limit, offset: 0 };
}
