import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Attendee RSVP round-tripping. Calendar invites embed RSVP=TRUE so native
 * clients reply over iMIP, but a self-hosted app can't reliably receive those
 * emails — so we mirror Rallly and put signed Accept / Decline / Tentative links
 * straight in the confirmation email. The signature stops anyone from flipping
 * another attendee's response by guessing the URL.
 */

const RSVP_STATUSES = ["accepted", "declined", "tentative"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export function isRsvpStatus(v: unknown): v is RsvpStatus {
  return typeof v === "string" && (RSVP_STATUSES as readonly string[]).includes(v);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Deterministic, unguessable token binding a booking + attendee email. Pure so
 * it can be unit-tested with a fixed secret; the server passes env.authSecret.
 */
export function rsvpToken(uid: string, email: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`rsvp:${uid}:${normalizeEmail(email)}`)
    .digest("base64url")
    .slice(0, 32);
}

/** Constant-time token check. */
export function verifyRsvpToken(
  uid: string,
  email: string,
  token: string,
  secret: string,
): boolean {
  const expected = rsvpToken(uid, email, secret);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
