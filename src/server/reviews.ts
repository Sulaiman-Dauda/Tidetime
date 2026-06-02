import "server-only";
import { and, eq, desc, gte, isNull, lt, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  reviews,
  bookings,
  attendees,
  eventTypes,
  users,
  type Review,
} from "@/db/schema";
import {
  routeReview,
  summarizeRatings,
  DEFAULT_REVIEW_THRESHOLD,
  type ReviewOutcome,
} from "@/lib/reviews";
import { sendMail } from "./mailer";
import { logBookingActivity } from "./activity";
import { env } from "@/lib/env";

export interface ReviewContext {
  booking: { id: number; uid: string; title: string; endTime: Date; status: string };
  host: { id: number | null; name: string | null; reviewThreshold: number; googleReviewUrl: string | null };
  attendee: { name: string; email: string } | null;
  existingReview: Review | null;
}

/** Load everything the public review page needs, keyed by the booking UID. */
export async function getReviewContext(bookingUid: string): Promise<ReviewContext | null> {
  const [b] = await db
    .select({
      id: bookings.id,
      uid: bookings.uid,
      title: bookings.title,
      endTime: bookings.endTime,
      status: bookings.status,
      userId: bookings.userId,
      hostName: users.name,
      threshold: users.reviewThreshold,
      googleReviewUrl: users.googleReviewUrl,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.uid, bookingUid))
    .limit(1);
  if (!b) return null;

  const [primary] = await db
    .select({ name: attendees.name, email: attendees.email })
    .from(attendees)
    .where(and(eq(attendees.bookingId, b.id), eq(attendees.isPrimary, true)))
    .limit(1);

  const [existingReview] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.bookingId, b.id))
    .limit(1);

  return {
    booking: { id: b.id, uid: b.uid, title: b.title, endTime: b.endTime, status: b.status },
    host: {
      id: b.userId,
      name: b.hostName,
      reviewThreshold: b.threshold ?? DEFAULT_REVIEW_THRESHOLD,
      googleReviewUrl: b.googleReviewUrl ?? null,
    },
    attendee: primary ?? null,
    existingReview: existingReview ?? null,
  };
}

export interface SubmitReviewResult {
  ok: boolean;
  error?: string;
  outcome?: ReviewOutcome;
}

/**
 * Persist a review for a booking and decide the reputation routing:
 * happy ratings get a Google-Reviews redirect URL; the rest are stored as
 * private feedback. One review per booking.
 */
export async function submitReview(
  bookingUid: string,
  rating: number,
  feedback?: string,
): Promise<SubmitReviewResult> {
  const ctx = await getReviewContext(bookingUid);
  if (!ctx) return { ok: false, error: "Booking not found" };
  if (ctx.existingReview) return { ok: false, error: "A review has already been submitted" };

  const outcome = routeReview(rating, {
    publicUrl: ctx.host.googleReviewUrl,
    threshold: ctx.host.reviewThreshold,
  });
  if (outcome.kind === "invalid") return { ok: false, error: outcome.error };

  await db.insert(reviews).values({
    bookingId: ctx.booking.id,
    userId: ctx.host.id,
    rating: Math.round(rating),
    feedback: feedback?.trim() || null,
    attendeeEmail: ctx.attendee?.email ?? null,
    attendeeName: ctx.attendee?.name ?? null,
    redirectedToPublic: outcome.kind === "redirect",
  });

  await logBookingActivity(ctx.booking.id, "review_submitted", {
    actor: ctx.attendee?.name ?? ctx.attendee?.email ?? null,
    message: `Rated ${Math.round(rating)} / 5`,
    data: { rating: Math.round(rating), redirectedToPublic: outcome.kind === "redirect" },
  });

  return { ok: true, outcome };
}

export interface ReviewListItem {
  id: number;
  rating: number;
  feedback: string | null;
  attendeeName: string | null;
  createdAt: Date;
  bookingUid: string;
  eventTitle: string | null;
}

/** Reviews for a host, newest first (dashboard). */
export async function listReviews(userId: number, limit = 100): Promise<ReviewListItem[]> {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      feedback: reviews.feedback,
      attendeeName: reviews.attendeeName,
      createdAt: reviews.createdAt,
      bookingUid: bookings.uid,
      eventTitle: eventTypes.title,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .leftJoin(eventTypes, eq(bookings.eventTypeId, eventTypes.id))
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function deleteReview(id: number, userId: number): Promise<void> {
  await db
    .delete(reviews)
    .where(and(eq(reviews.id, id), eq(reviews.userId, userId)));
}

export async function reviewStats(userId: number): Promise<{
  count: number;
  average: number;
  distribution: Record<number, number>;
  publicCount: number;
  privateCount: number;
}> {
  const rows = await db
    .select({ rating: reviews.rating, redirectedToPublic: reviews.redirectedToPublic })
    .from(reviews)
    .where(eq(reviews.userId, userId));
  const base = summarizeRatings(rows.map((r) => r.rating));
  const publicCount = rows.filter((r) => r.redirectedToPublic).length;
  return { ...base, publicCount, privateCount: rows.length - publicCount };
}

function reviewRequestHtml(title: string, reviewUrl: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;padding:24px;">
<h2 style="margin:0 0 8px;">How did it go?</h2>
<p style="margin:0 0 12px;color:#475569;">Thanks for attending <strong>${title}</strong>. We'd love your quick feedback.</p>
<a href="${reviewUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;">Leave a review</a>
</body></html>`;
}

export interface ReviewRequestResult {
  processed: number;
  sent: number;
}

/**
 * Send review-request emails for bookings that ended recently whose host has
 * review requests enabled. Idempotent: `reviewRequestSentAt` guards re-sends.
 * Designed to run from the reminder cron worker.
 */
export async function sendReviewRequests(now: Date = new Date()): Promise<ReviewRequestResult> {
  // Look back a bounded window so the first run after enabling doesn't spam old bookings.
  const windowStart = new Date(now.getTime() - 24 * 60 * 60000);

  const due = await db
    .select({
      bookingId: bookings.id,
      uid: bookings.uid,
      title: bookings.title,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(
      and(
        eq(bookings.status, "accepted"),
        eq(users.reviewRequestsEnabled, true),
        isNull(bookings.reviewRequestSentAt),
        lt(bookings.endTime, now),
        gte(bookings.endTime, windowStart),
      ),
    )
    .limit(500);

  if (due.length === 0) return { processed: 0, sent: 0 };

  let sent = 0;
  for (const b of due) {
    const [primary] = await db
      .select({ email: attendees.email })
      .from(attendees)
      .where(and(eq(attendees.bookingId, b.bookingId), eq(attendees.isPrimary, true)))
      .limit(1);
    try {
      if (primary) {
        const url = `${env.appUrl}/booking/${b.uid}/review`;
        await sendMail({
          to: primary.email,
          subject: `How was ${b.title}?`,
          html: reviewRequestHtml(b.title, url),
        });
        sent++;
      }
    } catch {
      // best-effort
    } finally {
      await db
        .update(bookings)
        .set({ reviewRequestSentAt: new Date() })
        .where(eq(bookings.id, b.bookingId));
    }
  }

  return { processed: due.length, sent };
}

/** Convenience for callers that already hold a set of booking ids. */
export async function hasReview(bookingIds: number[]): Promise<Set<number>> {
  if (bookingIds.length === 0) return new Set();
  const rows = await db
    .select({ bookingId: reviews.bookingId })
    .from(reviews)
    .where(inArray(reviews.bookingId, bookingIds));
  return new Set(rows.map((r) => r.bookingId));
}
