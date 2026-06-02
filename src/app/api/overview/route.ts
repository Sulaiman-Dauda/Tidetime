import { NextResponse } from "next/server";
import { and, eq, gte, lte, asc, count, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, attendees } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Counts
  const [upcomingCount] = await db
    .select({ count: count() })
    .from(bookings)
    .where(and(eq(bookings.userId, user.id), eq(bookings.status, "accepted"), gte(bookings.endTime, now)));

  const [pendingCount] = await db
    .select({ count: count() })
    .from(bookings)
    .where(and(eq(bookings.userId, user.id), eq(bookings.status, "pending")));

  // Today's events
  const todayRows = await db
    .select({
      id: bookings.id,
      uid: bookings.uid,
      title: bookings.title,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
    })
    .from(bookings)
    .where(and(
      eq(bookings.userId, user.id),
      eq(bookings.status, "accepted"),
      gte(bookings.startTime, todayStart),
      lte(bookings.startTime, todayEnd),
    ))
    .orderBy(asc(bookings.startTime))
    .limit(10);

  // Upcoming events (excluding today's)
  const upcomingRows = await db
    .select({
      id: bookings.id,
      uid: bookings.uid,
      title: bookings.title,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
    })
    .from(bookings)
    .where(and(
      eq(bookings.userId, user.id),
      eq(bookings.status, "accepted"),
      gte(bookings.startTime, todayEnd),
      lte(bookings.startTime, weekEnd),
    ))
    .orderBy(asc(bookings.startTime))
    .limit(8);

  // Fetch attendees for all events
  const allIds = [...todayRows.map(r => r.id), ...upcomingRows.map(r => r.id)];
  const attendeeMap = new Map<number, string>();
  if (allIds.length > 0) {
    const ats = await db
      .select({ bookingId: attendees.bookingId, name: attendees.name, isPrimary: attendees.isPrimary })
      .from(attendees)
      .where(inArray(attendees.bookingId, allIds));
    for (const a of ats) {
      if (a.isPrimary || !attendeeMap.has(a.bookingId)) {
        attendeeMap.set(a.bookingId, a.name);
      }
    }
  }

  function mapEvent(r: { uid: string; title: string; startTime: Date; endTime: Date; id: number }) {
    return {
      uid: r.uid,
      title: r.title,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
      attendeeName: attendeeMap.get(r.id) ?? null,
    };
  }

  return NextResponse.json({
    upcoming: upcomingCount?.count ?? 0,
    pending: pendingCount?.count ?? 0,
    today: todayRows.map(mapEvent),
    thisWeek: upcomingRows.map(mapEvent),
  });
}
