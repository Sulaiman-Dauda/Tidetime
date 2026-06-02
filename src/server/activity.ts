import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingActivity, type BookingActivity } from "@/db/schema";

export type BookingActivityType =
  | "created"
  | "rescheduled"
  | "cancelled"
  | "confirmed"
  | "rejected"
  | "payment_succeeded"
  | "reminder_sent"
  | "review_submitted"
  | "no_show";

/**
 * Append an entry to a booking's activity timeline. Best-effort: failures are
 * swallowed so logging can never break the booking flow.
 */
export async function logBookingActivity(
  bookingId: number,
  type: BookingActivityType,
  opts: { actor?: string | null; message?: string | null; data?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await db.insert(bookingActivity).values({
      bookingId,
      type,
      actor: opts.actor ?? null,
      message: opts.message ?? null,
      data: opts.data ?? null,
    });
  } catch {
    // intentionally ignored — activity logging must never block a booking
  }
}

/** List a booking's activity timeline, newest first. */
export async function listBookingActivity(bookingId: number): Promise<BookingActivity[]> {
  return db
    .select()
    .from(bookingActivity)
    .where(eq(bookingActivity.bookingId, bookingId))
    .orderBy(desc(bookingActivity.createdAt));
}
