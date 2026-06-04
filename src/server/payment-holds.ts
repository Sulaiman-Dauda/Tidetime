import "server-only";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { bookings, eventTypes, payments } from "@/db/schema";

export const PAYMENT_HOLD_MINUTES = 30;
export const PAYMENT_HOLD_MS = PAYMENT_HOLD_MINUTES * 60 * 1000;

/**
 * Cancel stale unpaid booking holds created for Stripe checkout so abandoned
 * payments do not block the slot forever.
 */
export async function expireStalePaymentHolds(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PAYMENT_HOLD_MS);
  const stale = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(eventTypes, eq(bookings.eventTypeId, eventTypes.id))
    .where(
      and(
        eq(bookings.status, "pending"),
        eq(bookings.paid, false),
        eq(eventTypes.requiresPayment, true),
        lte(bookings.createdAt, cutoff),
      ),
    );

  if (stale.length === 0) return 0;

  const ids = stale.map((row) => row.id);
  await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancellationReason: "Payment not completed",
      updatedAt: now,
    })
    .where(inArray(bookings.id, ids));

  await db
    .update(payments)
    .set({ status: "failed", success: false })
    .where(and(inArray(payments.bookingId, ids), eq(payments.status, "pending")));

  return ids.length;
}
