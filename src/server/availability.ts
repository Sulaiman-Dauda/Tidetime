import "server-only";
import { and, eq, gte, lt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  eventTypes,
  schedules,
  availabilities,
  bookings,
  outOfOffice,
  blockedPeriods,
  users,
  type EventType,
} from "@/db/schema";
import { computeSlots, type AvailabilityRule, type Interval, type Slot } from "@/lib/slots";
import { resourceBusyIntervals } from "./resources";

export interface ResolvedEventType extends EventType {
  hostTimeZone: string;
  scheduleTimeZone: string;
}

/** Load an event type for a user handle + slug, with the host's timezone. */
export async function getPublicEventType(
  username: string,
  slug: string,
): Promise<{ eventType: ResolvedEventType; host: { id: number; name: string | null; username: string; avatarUrl: string | null; bio: string | null } } | null> {
  const [row] = await db
    .select({
      et: eventTypes,
      userId: users.id,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      userTz: users.timeZone,
      scheduleTz: schedules.timeZone,
    })
    .from(eventTypes)
    .innerJoin(users, eq(eventTypes.userId, users.id))
    .leftJoin(schedules, eq(eventTypes.scheduleId, schedules.id))
    .where(and(eq(users.username, username), eq(eventTypes.slug, slug)))
    .limit(1);

  if (!row) return null;

  return {
    eventType: {
      ...row.et,
      hostTimeZone: row.userTz,
      scheduleTimeZone: row.scheduleTz ?? row.userTz,
    },
    host: { id: row.userId, name: row.name, username: row.username, avatarUrl: row.avatarUrl, bio: row.bio },
  };
}

/** Load the availability rules for an event type's schedule (or host default). */
async function loadRules(eventType: ResolvedEventType): Promise<AvailabilityRule[]> {
  let scheduleId = eventType.scheduleId;
  if (!scheduleId && eventType.userId) {
    const [u] = await db
      .select({ defaultScheduleId: users.defaultScheduleId })
      .from(users)
      .where(eq(users.id, eventType.userId))
      .limit(1);
    scheduleId = u?.defaultScheduleId ?? null;
  }
  if (!scheduleId) return [];

  const rows = await db.select().from(availabilities).where(eq(availabilities.scheduleId, scheduleId));
  return rows.map((r) => ({
    days: r.days,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
  }));
}

/** Existing bookings + OOO as busy intervals for the host within a window. */
async function loadBusy(userId: number, rangeStart: Date, rangeEnd: Date): Promise<Interval[]> {
  const busy: Interval[] = [];

  const existing = await db
    .select({ startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, ["accepted", "pending"]),
        lt(bookings.startTime, rangeEnd),
        gte(bookings.endTime, rangeStart),
      ),
    );
  for (const b of existing) busy.push({ start: b.startTime.getTime(), end: b.endTime.getTime() });

  const ooo = await db
    .select({ start: outOfOffice.start, end: outOfOffice.end })
    .from(outOfOffice)
    .where(and(eq(outOfOffice.userId, userId), lt(outOfOffice.start, rangeEnd), gte(outOfOffice.end, rangeStart)));
  for (const o of ooo) busy.push({ start: o.start.getTime(), end: o.end.getTime() });

  return busy;
}

/** Instance-wide blocked periods (holidays, closures) that apply to every host. */
async function loadBlockedPeriods(rangeStart: Date, rangeEnd: Date): Promise<Interval[]> {
  const rows = await db
    .select({ start: blockedPeriods.start, end: blockedPeriods.end })
    .from(blockedPeriods)
    .where(
      and(
        isNull(blockedPeriods.teamId),
        lt(blockedPeriods.start, rangeEnd),
        gte(blockedPeriods.end, rangeStart),
      ),
    );
  return rows.map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }));
}

/** Seat occupancy counts keyed by ISO start time, for group events. */
async function loadSeatCounts(eventTypeId: number, rangeStart: Date, rangeEnd: Date): Promise<Record<string, number>> {
  const rows = await db
    .select({ startTime: bookings.startTime, id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventTypeId, eventTypeId),
        inArray(bookings.status, ["accepted", "pending"]),
        gte(bookings.startTime, rangeStart),
        lt(bookings.startTime, rangeEnd),
      ),
    );
  // Count attendees per slot.
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const iso = r.startTime.toISOString();
    counts[iso] = (counts[iso] ?? 0) + 1;
  }
  return counts;
}

export interface GetSlotsArgs {
  eventType: ResolvedEventType;
  rangeStart: Date;
  rangeEnd: Date;
  duration?: number;
  now?: Date;
}

/** Top-level: compute bookable slots for a public event type. */
export async function getSlots({ eventType, rangeStart, rangeEnd, duration, now }: GetSlotsArgs): Promise<Slot[]> {
  if (eventType.hidden) return [];
  const rules = await loadRules(eventType);
  if (rules.length === 0) return [];

  const dur = duration ?? eventType.length;
  const seatsPerSlot = eventType.seatsPerTimeSlot ?? 1;

  const busy =
    seatsPerSlot > 1 ? [] : eventType.userId ? await loadBusy(eventType.userId, rangeStart, rangeEnd) : [];
  const seatCounts = seatsPerSlot > 1 ? await loadSeatCounts(eventType.id, rangeStart, rangeEnd) : undefined;

  // Exclude times where a required resource (room/equipment/…) is at capacity.
  const resourceBusy = await resourceBusyIntervals(eventType.id, rangeStart, rangeEnd);
  if (resourceBusy.length > 0) busy.push(...resourceBusy);

  // Apply instance-wide blocked periods (holidays / closures) to every event.
  const blocked = await loadBlockedPeriods(rangeStart, rangeEnd);
  if (blocked.length > 0) busy.push(...blocked);

  return computeSlots({
    rangeStart,
    rangeEnd,
    scheduleTimeZone: eventType.scheduleTimeZone,
    rules,
    duration: dur,
    slotInterval: eventType.slotInterval,
    offsetStart: eventType.offsetStart,
    beforeBuffer: eventType.beforeEventBuffer,
    afterBuffer: eventType.afterEventBuffer,
    minimumNotice: eventType.minimumBookingNotice,
    busy,
    seatsPerSlot,
    seatCounts,
    periodType: eventType.periodType,
    periodDays: eventType.periodDays,
    periodStartDate: eventType.periodStartDate,
    periodEndDate: eventType.periodEndDate,
    bookingLimits: eventType.bookingLimits ?? null,
    now,
  });
}

/** Verify a specific slot is still bookable (used at booking time, race-safe). */
export async function isSlotBookable(eventType: ResolvedEventType, startIso: string, duration: number): Promise<boolean> {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + duration * 60000);
  const slots = await getSlots({
    eventType,
    rangeStart: new Date(start.getTime() - 60000),
    rangeEnd: new Date(end.getTime() + 60000),
    duration,
  });
  return slots.some((s) => s.time === start.toISOString());
}
