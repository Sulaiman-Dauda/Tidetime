import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, attendees, payments, users } from "@/db/schema";
import { summarize, type AnalyticsBookingRow, type AnalyticsSummary } from "@/lib/analytics";

/**
 * Aggregate booking analytics for a host over an optional time window.
 * Uses set-based SQL aggregation rather than loading full datasets into memory.
 */
export async function getUserAnalytics(
  userId: number,
  since?: Date,
): Promise<AnalyticsSummary & { hostNames: Record<number, string> }> {
  const conditions = [eq(bookings.userId, userId)];
  if (since) conditions.push(gte(bookings.startTime, since));

  // Per-booking projection: status, start, no-show flag, captured revenue.
  const rows = await db
    .select({
      status: bookings.status,
      startTime: bookings.startTime,
      userId: bookings.userId,
      noShow: sql<boolean>`coalesce(bool_or(${attendees.noShow}), false)`,
      revenue: sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'paid'), 0)::int`,
    })
    .from(bookings)
    .leftJoin(attendees, eq(attendees.bookingId, bookings.id))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .where(and(...conditions))
    .groupBy(bookings.id);

  const mapped: AnalyticsBookingRow[] = rows.map((r) => ({
    status: r.status,
    startTime: r.startTime,
    noShow: r.noShow,
    revenue: r.revenue,
    userId: r.userId,
  }));

  const summary = summarize(mapped);

  // Resolve host names for utilization display.
  const hostIds = Object.keys(summary.utilization).map(Number);
  const hostNames: Record<number, string> = {};
  if (hostIds.length > 0) {
    const names = await db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(inArray(users.id, hostIds));
    for (const n of names) hostNames[n.id] = n.name ?? n.username;
  }

  return { ...summary, hostNames };
}
