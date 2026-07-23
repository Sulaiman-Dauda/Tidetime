import { and, asc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { bookings, attendees, memberships, services, serviceProviders, teams, users } from "@/db/schema";
import { CalendarView, type CalendarEvent } from "./calendar-view";
import type { CalendarService } from "./quick-booking-dialog";
import { can } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";
import { zonedTimeToUtc } from "@/lib/time";

const EVENT_LIMIT = 500;

interface Props {
  searchParams: Promise<{ month?: string }>;
}

/** Parse `YYYY-MM` into a year/month, defaulting to the current month. */
function parseMonth(value: string | undefined): { year: number; month: number } {
  const now = new Date();
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    if (month >= 0 && month <= 11) return { year, month };
  }
  return { year: now.getFullYear(), month: now.getMonth() };
}

async function loadEvents(
  userId: number,
  teamId: number,
  role: MembershipRole,
  year: number,
  month: number,
  timeZone: string,
): Promise<{ events: CalendarEvent[]; truncated: boolean }> {
  // Month boundaries in the viewer's timezone, padded by a week so events
  // bleeding into adjacent grid cells still load.
  const rangeStart = zonedTimeToUtc(year, month + 1, -6, 0, 0, timeZone);
  const rangeEnd = zonedTimeToUtc(year, month + 2, 7, 0, 0, timeZone);

  // Team-wide viewers are scoped by the members' bookings, not the service's
  // team — a booking whose service was deleted must not vanish.
  const teamWide = can(role, "booking.all.view");
  const memberRows = teamWide
    ? await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(and(eq(memberships.teamId, teamId), eq(memberships.accepted, true)))
    : [];
  const scopeIds = teamWide ? memberRows.map((row) => row.userId) : [userId];

  const rows = await db
    .select({ booking: bookings, serviceTitle: services.title, hostName: users.name, hostUsername: users.username })
    .from(bookings)
    .leftJoin(services, eq(services.id, bookings.serviceId))
    .leftJoin(users, eq(users.id, bookings.userId))
    .where(
      and(
        // Members' bookings OR this team's services — robust to both deleted
        // services and removed members.
        teamWide
          ? or(inArray(bookings.userId, scopeIds), eq(services.teamId, teamId))
          : inArray(bookings.userId, scopeIds),
        inArray(bookings.status, ["accepted", "pending"]),
        gte(bookings.startTime, rangeStart),
        lt(bookings.startTime, rangeEnd),
      ),
    )
    .orderBy(bookings.startTime)
    .limit(EVENT_LIMIT + 1);

  const truncated = rows.length > EVENT_LIMIT;
  const bookingRows = rows.slice(0, EVENT_LIMIT);
  if (bookingRows.length === 0) return { events: [], truncated: false };

  const ats = await db
    .select()
    .from(attendees)
    .where(inArray(attendees.bookingId, bookingRows.map((r) => r.booking.id)));

  const nameByBooking = new Map<number, string>();
  for (const a of ats) {
    if (!nameByBooking.has(a.bookingId) || a.isPrimary) nameByBooking.set(a.bookingId, a.name);
  }

  return {
    truncated,
    events: bookingRows.map(({ booking: r, serviceTitle, hostName, hostUsername }) => ({
      uid: r.uid,
      title: serviceTitle ?? r.title,
      start: r.startTime.toISOString(),
      end: r.endTime.toISOString(),
      status: r.status as "accepted" | "pending",
      location: r.location,
      attendee: nameByBooking.get(r.id) ?? null,
      hostId: r.userId,
      hostName: teamWide ? hostName ?? hostUsername ?? null : null,
    })),
  };
}

/** The host's own bookable services, for quick-create from the calendar. */
async function loadServices(
  userId: number,
  teamId: number,
  role: MembershipRole,
): Promise<CalendarService[]> {
  const selection = {
    slug: services.slug,
    teamSlug: teams.slug,
    title: services.title,
    length: services.length,
    hidden: services.hidden,
  };
  const rows = can(role, "booking.all.manage")
    ? await db
        .select(selection)
        .from(services)
        .innerJoin(teams, eq(teams.id, services.teamId))
        .where(eq(services.teamId, teamId))
        .orderBy(asc(services.position), asc(services.createdAt))
    : await db
    .select({
      ...selection,
    })
    .from(serviceProviders)
    .innerJoin(services, eq(services.id, serviceProviders.serviceId))
    .innerJoin(teams, eq(teams.id, services.teamId))
    .where(eq(serviceProviders.userId, userId))
    .orderBy(asc(services.position), asc(services.createdAt));
  return rows
    .filter((r) => !r.hidden)
    .map((r) => ({ slug: r.slug, teamSlug: r.teamSlug, title: r.title, length: r.length }));
}

export default async function CalendarPage({ searchParams }: Props) {
  const { user, role, teamId } = await requireAnyPermission([
    "booking.own.view",
    "booking.all.view",
  ]);
  const { year, month } = parseMonth((await searchParams).month);
  const [{ events, truncated }, calendarServices, teamMembers] = await Promise.all([
    loadEvents(user.id, teamId, role, year, month, user.timeZone),
    loadServices(user.id, teamId, role),
    can(role, "booking.all.view")
      ? db
          .select({ id: users.id, name: users.name, username: users.username })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(and(eq(memberships.teamId, teamId), eq(memberships.accepted, true)))
          .orderBy(asc(users.name))
      : Promise.resolve([]),
  ]);

  return (
    <CalendarView
      year={year}
      month={month}
      events={events}
      truncated={truncated}
      timeZone={user.timeZone}
      hour12={user.timeFormat === 12}
      weekStart={user.weekStart}
      services={calendarServices}
      teamMembers={teamMembers.map((m) => ({ id: m.id, name: m.name ?? m.username }))}
    />
  );
}
