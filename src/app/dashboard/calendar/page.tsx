import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, attendees } from "@/db/schema";
import { CalendarView, type CalendarEvent } from "./calendar-view";

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

async function loadEvents(userId: number, year: number, month: number): Promise<CalendarEvent[]> {
  // Pad the range by a few days so events bleeding into adjacent weeks still load.
  const rangeStart = new Date(year, month, -6);
  const rangeEnd = new Date(year, month + 1, 7);

  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, ["accepted", "pending"]),
        gte(bookings.startTime, rangeStart),
        lt(bookings.startTime, rangeEnd),
      ),
    )
    .orderBy(bookings.startTime)
    .limit(500);

  if (rows.length === 0) return [];

  const ats = await db
    .select()
    .from(attendees)
    .where(inArray(attendees.bookingId, rows.map((r) => r.id)));

  const nameByBooking = new Map<number, string>();
  for (const a of ats) {
    if (!nameByBooking.has(a.bookingId) || a.isPrimary) nameByBooking.set(a.bookingId, a.name);
  }

  return rows.map((r) => ({
    uid: r.uid,
    title: r.title,
    start: r.startTime.toISOString(),
    end: r.endTime.toISOString(),
    status: r.status as "accepted" | "pending",
    location: r.location,
    attendee: nameByBooking.get(r.id) ?? null,
  }));
}

export default async function CalendarPage({ searchParams }: Props) {
  const user = await requireUser();
  const { year, month } = parseMonth((await searchParams).month);
  const events = await loadEvents(user.id, year, month);

  return <CalendarView year={year} month={month} events={events} timeZone={user.timeZone} />;
}
