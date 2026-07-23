import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { requireAnyPermission } from "@/lib/guard";
import { db } from "@/db";
import { bookings, attendees, services, serviceProviders, teams } from "@/db/schema";
import { CalendarView, type CalendarEvent } from "./calendar-view";
import type { CalendarService } from "./quick-booking-dialog";
import { can } from "@/lib/rbac";
import type { MembershipRole } from "@/db/schema";

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
): Promise<CalendarEvent[]> {
  // Pad the range by a few days so events bleeding into adjacent weeks still load.
  const rangeStart = new Date(year, month, -6);
  const rangeEnd = new Date(year, month + 1, 7);

  const rows = await db
    .select({ booking: bookings })
    .from(bookings)
    .leftJoin(services, eq(services.id, bookings.serviceId))
    .where(
      and(
        can(role, "booking.all.view")
          ? eq(services.teamId, teamId)
          : eq(bookings.userId, userId),
        inArray(bookings.status, ["accepted", "pending"]),
        gte(bookings.startTime, rangeStart),
        lt(bookings.startTime, rangeEnd),
      ),
    )
    .orderBy(bookings.startTime)
    .limit(500);

  if (rows.length === 0) return [];
  const bookingRows = rows.map((row) => row.booking);

  const ats = await db
    .select()
    .from(attendees)
    .where(inArray(attendees.bookingId, bookingRows.map((r) => r.id)));

  const nameByBooking = new Map<number, string>();
  for (const a of ats) {
    if (!nameByBooking.has(a.bookingId) || a.isPrimary) nameByBooking.set(a.bookingId, a.name);
  }

  return bookingRows.map((r) => ({
    uid: r.uid,
    title: r.title,
    start: r.startTime.toISOString(),
    end: r.endTime.toISOString(),
    status: r.status as "accepted" | "pending",
    location: r.location,
    attendee: nameByBooking.get(r.id) ?? null,
  }));
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
  const [events, services] = await Promise.all([
    loadEvents(user.id, teamId, role, year, month),
    loadServices(user.id, teamId, role),
  ]);

  return (
    <CalendarView
      year={year}
      month={month}
      events={events}
      timeZone={user.timeZone}
      services={services}
    />
  );
}
