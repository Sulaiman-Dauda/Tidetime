"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createBooking, cancelBooking } from "@/server/bookings";
import { timeZoneSchema } from "@/lib/schemas";
import {
  checkRateLimit,
  isHoneypotFilled,
  isSubmittedTooFast,
  clientIpFromHeaders,
} from "@/lib/rate-limit";
import { isBookingDisabled } from "@/server/company-settings";
import { expireStalePaymentHolds } from "@/server/payment-holds";

const bookingSchema = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  teamSlug: z.string().optional(),
  start: z.string().datetime(),
  duration: z.coerce.number().int().positive().optional(),
  timeZone: timeZoneSchema,
  name: z.string().min(1, "Name is required").max(128),
  email: z.string().email("Enter a valid email"),
  responses: z.record(z.unknown()).default({}),
  guests: z.array(z.string().email()).optional(),
  rescheduleUid: z.string().optional(),
  idempotencyKey: z.string().optional(),
  bookingLinkToken: z.string().optional(),
  /** anti-spam: honeypot value (must be empty) + form render timestamp */
  hp: z.string().optional(),
  ts: z.number().optional(),
});

export type BookActionState = { error?: string; uid?: string; requiresPayment?: boolean; paymentClientSecret?: string } | null;

export async function bookAction(_prev: BookActionState, formData: FormData): Promise<BookActionState> {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: "Invalid request" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid request" };
  }

  const result = bookingSchema.safeParse(parsed);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid booking" };
  }

  // Anti-spam: silently drop honeypot hits and implausibly fast submissions.
  if (isHoneypotFilled(result.data.hp) || isSubmittedTooFast(result.data.ts)) {
    // Generic message — don't reveal the bot detection.
    return { error: "We couldn't process that request. Please try again." };
  }

  await expireStalePaymentHolds();

  if (await isBookingDisabled()) {
    return { error: "Booking is temporarily disabled. Please try again later." };
  }

  const h = await headers();
  const ip = clientIpFromHeaders(h);

  // Per-IP throttle: cap booking attempts from a single client.
  const ipLimit = checkRateLimit(`book:ip:${ip}`, { limit: 10, windowMs: 60 * 1000 });
  if (!ipLimit.ok) return { error: "Too many booking attempts. Please slow down and try again." };

  // Per-link throttle for one-time/limited links.
  if (result.data.bookingLinkToken) {
    const linkLimit = checkRateLimit(`book:link:${result.data.bookingLinkToken}`, {
      limit: 15,
      windowMs: 60 * 1000,
    });
    if (!linkLimit.ok) return { error: "Too many attempts on this link. Please try again later." };
  }

  // Derive an idempotency key from the payload if not supplied.
  const idempotencyKey =
    result.data.idempotencyKey ??
    `${result.data.email}:${result.data.slug}:${result.data.start}:${ip}`.slice(0, 64);

  const { hp: _hp, ts: _ts, ...bookingInput } = result.data;
  const booking = await createBooking({ ...bookingInput, idempotencyKey });
  if (!booking.ok) return { error: booking.error ?? "Could not complete booking" };
  if (booking.requiresPayment && booking.paymentClientSecret) {
    return { uid: booking.uid, requiresPayment: true, paymentClientSecret: booking.paymentClientSecret };
  }
  return { uid: booking.uid };
}

const cancelSchema = z.object({
  uid: z.string().min(1),
  reason: z.string().max(500).optional(),
  series: z.coerce.boolean().optional(),
});

export async function cancelBookingAction(_prev: BookActionState, formData: FormData): Promise<BookActionState> {
  const result = cancelSchema.safeParse({
    uid: formData.get("uid"),
    reason: formData.get("reason") || undefined,
    series: formData.get("series") === "on" || formData.get("series") === "true",
  });
  if (!result.success) return { error: "Invalid request" };

  const res = await cancelBooking(result.data.uid, result.data.reason, undefined, result.data.series ?? false);
  if (!res.ok) return { error: res.error ?? "Could not cancel" };
  return { uid: res.uid };
}
