import { getCurrentUser } from "@/lib/auth";
import { DashboardOverview, type OverviewData } from "./_components/dashboard-overview";
import { getAppUrl } from "@/server/app-url";
import { db } from "@/db";
import { attendees, bookings, memberships, teams } from "@/db/schema";
import { and, asc, count, eq, gte, inArray, lt } from "drizzle-orm";

export const metadata = { title: "Overview" };

async function loadOverview(userId: number): Promise<OverviewData> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [upcomingCount, pendingCount, todayRows, weekRows] = await Promise.all([
    db.select({ value: count() }).from(bookings).where(and(
      eq(bookings.userId, userId),
      eq(bookings.status, "accepted"),
      gte(bookings.endTime, now),
    )),
    db.select({ value: count() }).from(bookings).where(and(
      eq(bookings.userId, userId),
      eq(bookings.status, "pending"),
    )),
    db.select({
      id: bookings.id,
      uid: bookings.uid,
      title: bookings.title,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
    }).from(bookings).where(and(
      eq(bookings.userId, userId),
      eq(bookings.status, "accepted"),
      gte(bookings.startTime, todayStart),
      lt(bookings.startTime, tomorrow),
    )).orderBy(asc(bookings.startTime)).limit(10),
    db.select({
      id: bookings.id,
      uid: bookings.uid,
      title: bookings.title,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
    }).from(bookings).where(and(
      eq(bookings.userId, userId),
      eq(bookings.status, "accepted"),
      gte(bookings.startTime, tomorrow),
      lt(bookings.startTime, weekEnd),
    )).orderBy(asc(bookings.startTime)).limit(8),
  ]);

  const eventIds = [...todayRows, ...weekRows].map((row) => row.id);
  const attendeeRows = eventIds.length > 0
    ? await db.select({ bookingId: attendees.bookingId, name: attendees.name, isPrimary: attendees.isPrimary })
      .from(attendees)
      .where(inArray(attendees.bookingId, eventIds))
    : [];
  const attendeeByBooking = new Map<number, string>();
  for (const attendee of attendeeRows) {
    if (attendee.isPrimary || !attendeeByBooking.has(attendee.bookingId)) {
      attendeeByBooking.set(attendee.bookingId, attendee.name);
    }
  }

  const mapEvent = (row: (typeof todayRows)[number]) => ({
    uid: row.uid,
    title: row.title,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    attendeeName: attendeeByBooking.get(row.id) ?? null,
  });

  return {
    upcoming: upcomingCount[0]?.value ?? 0,
    pending: pendingCount[0]?.value ?? 0,
    today: todayRows.map(mapEvent),
    thisWeek: weekRows.map(mapEvent),
  };
}

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const appUrl = await getAppUrl();
  const [company] = await db.select({ slug: teams.slug }).from(memberships)
    .innerJoin(teams, eq(teams.id, memberships.teamId))
    .where(and(eq(memberships.userId, user.id), eq(memberships.accepted, true)))
    .orderBy(asc(memberships.id)).limit(1);
  const overview = await loadOverview(user.id);

  return (
    <div className="animate-fade-in">
      <DashboardOverview
        username={user.username}
        bookingUrl={`${appUrl}/book/${company?.slug ?? "company"}`}
        data={overview}
      />
    </div>
  );
}
