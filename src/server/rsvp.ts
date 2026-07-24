import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendees, bookings } from "@/db/schema";
import { deriveKey } from "@/lib/crypto";
import { getAppUrl } from "@/server/app-url";
import { isRsvpStatus, rsvpToken, verifyRsvpToken, type RsvpStatus } from "@/lib/rsvp";
import { logBookingActivity } from "./activity";

/** Signed Accept / Decline / Tentative links for a booking's attendee email. */
export async function buildRsvpLinks(uid: string, email: string) {
  const token = rsvpToken(uid, email, deriveKey("rsvp-token").toString("hex"));
  const base = `${await getAppUrl()}/booking/${uid}/rsvp`;
  const mk = (status: RsvpStatus) =>
    `${base}?status=${status}&email=${encodeURIComponent(email)}&t=${token}`;
  return { accept: mk("accepted"), decline: mk("declined"), tentative: mk("tentative") };
}

/**
 * Record an attendee's RSVP from a signed email link. Idempotent — re-clicking a
 * link just overwrites the prior response. The HMAC binds the response to the
 * (booking, email) pair so no one can flip another guest's answer.
 */
export async function respondToRsvp(
  uid: string,
  email: string,
  status: string,
  token: string,
): Promise<{ ok: boolean; status?: RsvpStatus; error?: string }> {
  if (!isRsvpStatus(status)) return { ok: false, error: "Invalid response." };
  const normalized = email.trim().toLowerCase();
  if (!normalized || !verifyRsvpToken(uid, normalized, token, deriveKey("rsvp-token").toString("hex"))) {
    return { ok: false, error: "This response link is no longer valid." };
  }

  const [b] = await db
    .select({ id: bookings.id, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.uid, uid))
    .limit(1);
  if (!b) return { ok: false, error: "Booking not found." };
  if (b.status === "cancelled" || b.status === "rejected") {
    return { ok: false, error: "This booking is no longer active." };
  }

  const updated = await db
    .update(attendees)
    .set({ rsvpStatus: status, rsvpRespondedAt: new Date() })
    .where(and(eq(attendees.bookingId, b.id), eq(sql`lower(${attendees.email})`, normalized)))
    .returning({ id: attendees.id, name: attendees.name });
  if (updated.length === 0) return { ok: false, error: "We couldn't find your invitation." };

  await logBookingActivity(b.id, "rsvp", {
    actor: updated[0].name,
    message: `RSVP: ${status}`,
    data: { status },
  }).catch(() => undefined);

  return { ok: true, status: status as RsvpStatus };
}
