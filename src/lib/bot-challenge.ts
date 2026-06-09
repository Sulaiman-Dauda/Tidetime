import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-signed bot challenge for public forms (the idea borrowed from
 * Nextcloud Appointments' multi-step bot check, adapted to be stateless).
 *
 * The booking page mints a token at render time that encodes *when* the server
 * issued the form, signed with the app secret. On submit we re-verify the
 * signature and the elapsed time. Unlike a plain client timestamp, the client
 * can't forge the issue time — so "submitted implausibly fast" (bot) and "form
 * is hours stale" (replay) become tamper-proof, with no database or cookie.
 */

const SEP = ".";

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Mint a challenge token stamped with the issue time. `now` is epoch ms. */
export function issueBotChallenge(secret: string, now: number = Date.now()): string {
  const issuedAt = String(now);
  return `${issuedAt}${SEP}${sign(secret, issuedAt)}`;
}

export interface BotChallengeOptions {
  /** reject submissions faster than this after issue (default 2s) */
  minMs?: number;
  /** reject forms older than this (default 2 hours) */
  maxMs?: number;
}

/**
 * Verify a challenge token. Returns true only when the signature is valid AND
 * the elapsed time since issue is within [minMs, maxMs]. A malformed, tampered,
 * too-fast or stale token returns false.
 */
export function verifyBotChallenge(
  secret: string,
  token: string | null | undefined,
  opts: BotChallengeOptions = {},
  now: number = Date.now(),
): boolean {
  const minMs = opts.minMs ?? 2000;
  const maxMs = opts.maxMs ?? 2 * 60 * 60 * 1000;
  if (typeof token !== "string") return false;

  const idx = token.indexOf(SEP);
  if (idx <= 0) return false;
  const issuedAtStr = token.slice(0, idx);
  const providedSig = token.slice(idx + 1);

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;

  const expected = sign(secret, issuedAtStr);
  // Timing-safe compare; bail if lengths differ (timingSafeEqual would throw).
  if (providedSig.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(providedSig), Buffer.from(expected))) return false;

  const elapsed = now - issuedAt;
  return elapsed >= minMs && elapsed <= maxMs;
}
