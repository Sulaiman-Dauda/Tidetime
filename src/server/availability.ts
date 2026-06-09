import "server-only";
import { and, eq, gt, gte, lt, lte, ne, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  eventTypes,
  schedules,
  availabilities,
  bookings,
  bookingHosts,
  outOfOffice,
  blockedPeriods,
  travelSchedules,
  users,
  type EventType,
} from "@/db/schema";
import { computeSlots, type AvailabilityRule, type Interval, type Slot } from "@/lib/slots";
import { resolveTimezoneSegments, type TravelPeriod } from "@/lib/travel";
import { fetchBusyTimes } from "./calendar";
import { expireStalePaymentHolds } from "./payment-holds";
import { addDaysToKey, formatDateKey, weekdayOfKey, zonedTimeToUtc } from "@/lib/time";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ResolvedEventType extends EventType {
  hostTimeZone: string;
  scheduleTimeZone: string;
}

/** Load a service for a user handle + slug, with the host's timezone. */
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
    .where(and(eq(users.username, username), eq(eventTypes.slug, slug), eq(eventTypes.draft, false)))
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

/** Load the availability rules for a service's schedule (or host default). */
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

  // Also block time where this user is a co-host (collective / multi-attendant).
  const coHosted = await db
    .select({ startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookingHosts)
    .innerJoin(bookings, eq(bookingHosts.bookingId, bookings.id))
    .where(
      and(
        eq(bookingHosts.userId, userId),
        inArray(bookings.status, ["accepted", "pending"]),
        lt(bookings.startTime, rangeEnd),
        gte(bookings.endTime, rangeStart),
      ),
    );
  for (const b of coHosted) busy.push({ start: b.startTime.getTime(), end: b.endTime.getTime() });

  const ooo = await db
    .select({ start: outOfOffice.start, end: outOfOffice.end })
    .from(outOfOffice)
    .where(and(eq(outOfOffice.userId, userId), lt(outOfOffice.start, rangeEnd), gte(outOfOffice.end, rangeStart)));
  for (const o of ooo) busy.push({ start: o.start.getTime(), end: o.end.getTime() });

  return busy;
}

/** A user's travel-schedule timezone overlays overlapping the requested window. */
async function loadTravelPeriods(
  userId: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<TravelPeriod[]> {
  const startKey = rangeStart.toISOString().slice(0, 10);
  const endKey = rangeEnd.toISOString().slice(0, 10);
  const rows = await db
    .select({
      timeZone: travelSchedules.timeZone,
      startDate: travelSchedules.startDate,
      endDate: travelSchedules.endDate,
    })
    .from(travelSchedules)
    .where(
      and(
        eq(travelSchedules.userId, userId),
        lte(travelSchedules.startDate, endKey),
        gte(travelSchedules.endDate, startKey),
      ),
    );
  return rows.map((r) => ({ timeZone: r.timeZone, startDate: r.startDate, endDate: r.endDate }));
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

/** Top-level: compute bookable slots for a public service. */
export async function getSlots({ eventType, rangeStart, rangeEnd, duration, now }: GetSlotsArgs): Promise<Slot[]> {
  if (eventType.hidden) return [];
  await expireStalePaymentHolds();
  const rules = await loadRules(eventType);
  if (rules.length === 0) return [];

  const dur = duration ?? eventType.length;
  const seatsPerSlot = eventType.seatsPerTimeSlot ?? 1;

  const busy =
    seatsPerSlot > 1 ? [] : eventType.userId ? await loadBusy(eventType.userId, rangeStart, rangeEnd) : [];
  const seatCounts = seatsPerSlot > 1 ? await loadSeatCounts(eventType.id, rangeStart, rangeEnd) : undefined;

  // Apply instance-wide blocked periods (holidays / closures) to every event.
  const blocked = await loadBlockedPeriods(rangeStart, rangeEnd);
  if (blocked.length > 0) busy.push(...blocked);

  // Fetch busy time from every connected calendar (Google, Microsoft 365, CalDAV).
  if (eventType.userId) {
    const externalBusy = await fetchBusyTimes(eventType.userId, rangeStart, rangeEnd);
    for (const gb of externalBusy) {
      busy.push({ start: new Date(gb.start).getTime(), end: new Date(gb.end).getTime() });
    }
  }

  const computeArgs = {
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
  };

  // Travel schedules: if the host has any timezone overrides covering this window,
  // split it into segments and compute each in the timezone in force. With no
  // travel periods this collapses to a single segment in the schedule timezone.
  const travels = eventType.userId
    ? await loadTravelPeriods(eventType.userId, rangeStart, rangeEnd)
    : [];
  if (travels.length === 0) {
    return computeSlots({
      rangeStart,
      rangeEnd,
      scheduleTimeZone: eventType.scheduleTimeZone,
      ...computeArgs,
    });
  }

  const segments = resolveTimezoneSegments(
    rangeStart,
    rangeEnd,
    eventType.scheduleTimeZone,
    travels,
  );
  const out: Slot[] = [];
  for (const seg of segments) {
    out.push(
      ...computeSlots({
        rangeStart: new Date(seg.start),
        rangeEnd: new Date(seg.end),
        scheduleTimeZone: seg.timeZone,
        ...computeArgs,
      }),
    );
  }
  return out;
}

/**
 * Direct overlap check: is `userId` already committed (as primary host or
 * co-host) to an accepted/pending booking that overlaps [start, end)?
 *
 * `isSlotBookable` answers "is this slot offerable" but is computed over a
 * separate read and so cannot, on its own, make check-then-insert atomic. This
 * helper is the in-transaction guard run under an advisory lock in
 * `createBooking` to close the double-booking race. Overlap is half-open:
 * an existing booking conflicts when `existing.start < end && existing.end > start`.
 */
export async function hostHasConflict(userId: number, start: Date, end: Date): Promise<boolean> {
  const overlaps = and(
    inArray(bookings.status, ["accepted", "pending"] as const),
    lt(bookings.startTime, end),
    gt(bookings.endTime, start),
  );
  const [primary] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.userId, userId), overlaps))
    .limit(1);
  if (primary) return true;
  const [co] = await db
    .select({ id: bookings.id })
    .from(bookingHosts)
    .innerJoin(bookings, eq(bookingHosts.bookingId, bookings.id))
    .where(and(eq(bookingHosts.userId, userId), overlaps))
    .limit(1);
  return Boolean(co);
}

/**
 * Number of accepted/pending bookings already in a group-event slot (one row
 * per booking, matching `loadSeatCounts`). Used to re-check seat capacity
 * inside the booking-creation lock so group events can't be oversold.
 */
export async function slotBookingCount(eventTypeId: number, start: Date): Promise<number> {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventTypeId, eventTypeId),
        eq(bookings.startTime, start),
        inArray(bookings.status, ["accepted", "pending"] as const),
      ),
    );
  return rows.length;
}

/** UTC [start, end) of the day/week/month/year containing `at`, in `tz`. */
function periodWindow(period: "day" | "week" | "month" | "year", at: Date, tz: string): { start: Date; end: Date } {
  const key = formatDateKey(at, tz);
  const [y, m, d] = key.split("-").map(Number);
  if (period === "day") {
    const next = addDaysToKey(key, 1).split("-").map(Number);
    return { start: zonedTimeToUtc(y, m, d, 0, 0, tz), end: zonedTimeToUtc(next[0], next[1], next[2], 0, 0, tz) };
  }
  if (period === "week") {
    // Monday-anchored week.
    const daysFromMonday = (weekdayOfKey(key) + 6) % 7;
    const startKey = addDaysToKey(key, -daysFromMonday).split("-").map(Number);
    const endKey = addDaysToKey(addDaysToKey(key, -daysFromMonday), 7).split("-").map(Number);
    return {
      start: zonedTimeToUtc(startKey[0], startKey[1], startKey[2], 0, 0, tz),
      end: zonedTimeToUtc(endKey[0], endKey[1], endKey[2], 0, 0, tz),
    };
  }
  if (period === "month") {
    return {
      start: zonedTimeToUtc(y, m, 1, 0, 0, tz),
      end: zonedTimeToUtc(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1, 0, 0, tz),
    };
  }
  return { start: zonedTimeToUtc(y, 1, 1, 0, 0, tz), end: zonedTimeToUtc(y + 1, 1, 1, 0, 0, tz) };
}

/**
 * Whether accepting a booking for this event type at `start` would exceed the
 * host's configured frequency caps (day/week/month/year), counting accepted +
 * pending bookings of the same event type within the period window that
 * contains `start` (in the schedule timezone). `excludeUid` skips the booking
 * being rescheduled so a same-period reschedule isn't blocked by its own row.
 *
 * Enforced at booking creation because the slot engine's `frequencyExhausted`
 * gate is range-wide and `now`-relative, so it can't precisely cap a specific
 * future slot's period. Returns the offending period name, or null.
 */
export async function bookingLimitExceeded(
  eventType: ResolvedEventType,
  start: Date,
  excludeUid?: string | null,
): Promise<string | null> {
  const limits = eventType.bookingLimits;
  if (!limits) return null;
  const periods: Array<"day" | "week" | "month" | "year"> = ["day", "week", "month", "year"];
  for (const period of periods) {
    const limit = limits[period];
    if (limit == null || limit <= 0) continue;
    const { start: ws, end: we } = periodWindow(period, start, eventType.scheduleTimeZone);
    const conds = [
      eq(bookings.eventTypeId, eventType.id),
      inArray(bookings.status, ["accepted", "pending"] as const),
      gte(bookings.startTime, ws),
      lt(bookings.startTime, we),
    ];
    if (excludeUid) conds.push(ne(bookings.uid, excludeUid));
    const rows = await db.select({ id: bookings.id }).from(bookings).where(and(...conds));
    if (rows.length >= limit) return period;
  }
  return null;
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

/** First bookable slot within a bounded search window for public landing pages. */
export async function findNextAvailableSlot(
  eventType: ResolvedEventType,
  opts?: { duration?: number; days?: number; now?: Date },
): Promise<Slot | null> {
  const now = opts?.now ?? new Date();
  const days = opts?.days ?? 30;
  const slots = await getSlots({
    eventType,
    duration: opts?.duration,
    now,
    rangeStart: now,
    rangeEnd: new Date(now.getTime() + days * DAY_MS),
  });
  return slots[0] ?? null;
}
