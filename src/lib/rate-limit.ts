/**
 * Lean, dependency-free, in-process rate limiter (fixed-window) plus anti-spam
 * helpers. Designed for single-instance self-hosting — no Redis required. State
 * lives in module memory, so limits are per-process; horizontal deployments
 * should front this with a shared store, but the default lean target is one node.
 */

export interface RateLimitOptions {
  /** max allowed hits within the window */
  limit: number;
  /** window length in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** hits remaining in the current window */
  remaining: number;
  /** epoch ms when the window resets */
  resetAt: number;
  /** ms until the caller may retry (0 when allowed) */
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;

function prune(now: number): void {
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Record a hit for `key` and report whether it is within the limit.
 * Pure aside from the shared in-memory map; deterministic given `now`.
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) prune(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: opts.limit - 1, resetAt, retryAfterMs: 0 };
  }

  if (existing.count >= opts.limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: opts.limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterMs: 0,
  };
}

/** Clear limiter state (test helper / manual reset). */
export function resetRateLimit(key?: string): void {
  if (key) buckets.delete(key);
  else buckets.clear();
}

/* ----------------------------- anti-spam ------------------------------- */

/**
 * Honeypot: a hidden form field that real users never fill. Any non-empty value
 * indicates a bot. Returns true when the submission should be rejected.
 */
export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Submit-time check: forms completed implausibly fast are almost always bots.
 * `renderedAt`/`now` are epoch ms; `minMs` defaults to 2 seconds.
 */
export function isSubmittedTooFast(
  renderedAt: number | null | undefined,
  minMs = 2000,
  now: number = Date.now(),
): boolean {
  if (!renderedAt || Number.isNaN(renderedAt)) return false; // can't tell — allow
  return now - renderedAt < minMs;
}

/** Derive a best-effort client IP from forwarding headers. */
export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
