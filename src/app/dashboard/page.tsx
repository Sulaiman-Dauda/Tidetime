import { requireAnyPermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";
import { DashboardOverview, type OverviewData } from "./_components/dashboard-overview";
import { getAppUrl } from "@/server/app-url";
import { db } from "@/db";
import { attendees, bookings, memberships, services, teams, users } from "@/db/schema";
import { and, asc, count, eq, gte, inArray, lt, or } from "drizzle-orm";
import { getZonedParts, zonedTimeToUtc, addDaysToKey } from "@/lib/time";

export const metadata = { title: "Overview" };

const TODAY_LIST_LIMIT = 10;
const WEEK_LIST_LIMIT = 8;

async function loadOverview(
  userId: number,
  teamId: number,
  role: MembershipRole,
  timeZone: string,
): Promise<OverviewData> {
  // Owner/admin/scheduler see the whole team (matching Bookings/Calendar);
  // members see their own bookings. Scoping by member ids rather than the
  // service's team keeps bookings whose service was deleted.
  const teamWide = can(role, "booking.all.view");
  const memberRows = teamWide
    ? await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(and(eq(memberships.teamId, teamId), eq(memberships.accepted, true)))
    : [];
  const scopeIds = teamWide ? memberRows.map((row) => row.userId) : [userId];
  // Members' bookings OR this team's services — robust to both deleted
  // services and removed members. Every query below left-joins services.
  const scope = teamWide
    ? or(inArray(bookings.userId, scopeIds), eq(services.teamId, teamId))!
    : inArray(bookings.userId, scopeIds);

  // Day windows in the viewer's timezone — the server's clock must not decide
  // what "today" means.
  const now = new Date();
  const parts = getZonedParts(now, timeZone);
  const todayKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const keyToUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return zonedTimeToUtc(y, m, d, 0, 0, timeZone);
  };
  const todayStart = keyToUtc(todayKey);
  const tomorrow = keyToUtc(addDaysToKey(todayKey, 1));
  const weekEnd = keyToUtc(addDaysToKey(todayKey, 7));

  const eventColumns = {
    id: bookings.id,
    uid: bookings.uid,
    title: bookings.title,
    serviceTitle: services.title,
    startTime: bookings.startTime,
    endTime: bookings.endTime,
    location: bookings.location,
    meetingUrl: bookings.meetingUrl,
    hostId: bookings.userId,
  };

  const [upcomingCount, pendingCount, todayCount, todayRows, weekRows, nextRows] =
    await Promise.all([
      db.select({ value: count() }).from(bookings).leftJoin(services, eq(services.id, bookings.serviceId)).where(and(
        scope,
        eq(bookings.status, "accepted"),
        gte(bookings.endTime, now),
      )),
      db.select({ value: count() }).from(bookings).leftJoin(services, eq(services.id, bookings.serviceId)).where(and(
        scope,
        eq(bookings.status, "pending"),
        gte(bookings.endTime, now),
      )),
      db.select({ value: count() }).from(bookings).leftJoin(services, eq(services.id, bookings.serviceId)).where(and(
        scope,
        eq(bookings.status, "accepted"),
        gte(bookings.startTime, todayStart),
        lt(bookings.startTime, tomorrow),
      )),
      db.select(eventColumns).from(bookings)
        .leftJoin(services, eq(services.id, bookings.serviceId))
        .where(and(
          scope,
          eq(bookings.status, "accepted"),
          gte(bookings.startTime, todayStart),
          lt(bookings.startTime, tomorrow),
        )).orderBy(asc(bookings.startTime)).limit(TODAY_LIST_LIMIT),
      db.select(eventColumns).from(bookings)
        .leftJoin(services, eq(services.id, bookings.serviceId))
        .where(and(
          scope,
          eq(bookings.status, "accepted"),
          gte(bookings.startTime, tomorrow),
          lt(bookings.startTime, weekEnd),
        )).orderBy(asc(bookings.startTime)).limit(WEEK_LIST_LIMIT),
      // First accepted booking beyond this week, so an otherwise-quiet week can
      // still point at what's next instead of an empty page.
      db.select(eventColumns).from(bookings)
        .leftJoin(services, eq(services.id, bookings.serviceId))
        .where(and(scope, eq(bookings.status, "accepted"), gte(bookings.startTime, weekEnd)))
        .orderBy(asc(bookings.startTime)).limit(1),
    ]);

  const listedRows = [...todayRows, ...weekRows, ...nextRows];
  const eventIds = listedRows.map((row) => row.id);
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

  // Host names for team-wide views, so owners can tell whose meeting it is.
  const hostIds = teamWide ? [...new Set(listedRows.map((r) => r.hostId).filter((v): v is number => v !== null))] : [];
  const hostRows = hostIds.length > 0
    ? await db.select({ id: users.id, name: users.name, username: users.username })
        .from(users).where(inArray(users.id, hostIds))
    : [];
  const hostById = new Map(hostRows.map((h) => [h.id, h.name ?? h.username]));

  const mapEvent = (row: (typeof todayRows)[number]) => ({
    uid: row.uid,
    title: row.serviceTitle ?? row.title,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    attendeeName: attendeeByBooking.get(row.id) ?? null,
    hostName: teamWide && row.hostId !== null ? hostById.get(row.hostId) ?? null : null,
    location: row.location,
    meetingUrl: row.meetingUrl,
  });

  return {
    upcoming: upcomingCount[0]?.value ?? 0,
    pending: pendingCount[0]?.value ?? 0,
    todayCount: todayCount[0]?.value ?? 0,
    today: todayRows.map(mapEvent),
    thisWeek: weekRows.map(mapEvent),
    nextUpcoming: nextRows[0] ? mapEvent(nextRows[0]) : null,
  };
}

export default async function DashboardPage() {
  const { user, role, teamId } = await requireAnyPermission([
    "booking.own.view",
    "booking.all.view",
  ]);
  const appUrl = await getAppUrl();
  const [company] = await db.select({ slug: teams.slug }).from(teams)
    .where(eq(teams.id, teamId)).limit(1);
  const overview = await loadOverview(user.id, teamId, role, user.timeZone);

  // Greeting + date are computed here, in the user's timezone, so SSR and
  // hydration render identical text regardless of the browser's clock.
  const parts = getZonedParts(new Date(), user.timeZone);
  const greeting = parts.hour < 12 ? "Good morning" : parts.hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.name ?? user.username).split(/\s+/)[0];
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: user.timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="animate-fade-in">
      <DashboardOverview
        greeting={`${greeting}, ${firstName}`}
        todayLabel={todayLabel}
        timeZone={user.timeZone}
        hour12={user.timeFormat === 12}
        bookingUrl={company ? `${appUrl}/book/${company.slug}` : null}
        data={overview}
      />
    </div>
  );
}
