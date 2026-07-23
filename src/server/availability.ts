import "server-only";
import { and, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { availabilities, bookings, type Service } from "@/db/schema";
import { computeSlots, type AvailabilityRule, type Interval, type Slot } from "@/lib/slots";
import { formatDateKey } from "@/lib/time";
import { fetchBusyTimes } from "./calendar";

/**
 * A company service evaluated for one provider. Provider information is
 * runtime-only because services belong to the company and providers are
 * assigned through the service-provider join table.
 */
export interface ResolvedService extends Service {
  providerId: number | null;
  providerScheduleId: number | null;
  hostTimeZone: string;
  scheduleTimeZone: string;
}

async function loadRules(service: ResolvedService): Promise<AvailabilityRule[]> {
  if (!service.providerScheduleId) return [];
  const rows = await db
    .select()
    .from(availabilities)
    .where(eq(availabilities.scheduleId, service.providerScheduleId));
  return rows.map((row) => ({
    days: row.days,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
  }));
}

async function loadBusyRows(providerId: number, rangeStart: Date, rangeEnd: Date) {
  return db
    .select({
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      serviceId: bookings.serviceId,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, providerId),
        inArray(bookings.status, ["accepted", "pending"]),
        lt(bookings.startTime, rangeEnd),
        gte(bookings.endTime, rangeStart),
      ),
    );
}

/** Compute bookable slots for one provider and service. */
export async function getSlots({
  service,
  rangeStart,
  rangeEnd,
  duration,
  now,
}: {
  service: ResolvedService;
  rangeStart: Date;
  rangeEnd: Date;
  duration?: number;
  now?: Date;
}): Promise<Slot[]> {
  if (service.hidden || !service.providerId) return [];
  const rules = await loadRules(service);
  if (rules.length === 0) return [];

  const busyRows = await loadBusyRows(service.providerId, rangeStart, rangeEnd);
  const busy: Interval[] = busyRows.map((row) => ({
    start: row.startTime.getTime(),
    end: row.endTime.getTime(),
  }));
  const externalBusy = await fetchBusyTimes(service.providerId, rangeStart, rangeEnd);
  for (const item of externalBusy) {
    busy.push({
      start: new Date(item.start).getTime(),
      end: new Date(item.end).getTime(),
    });
  }

  const effectiveDuration = duration ?? service.length;
  let slots = computeSlots({
    rangeStart,
    rangeEnd,
    scheduleTimeZone: service.scheduleTimeZone,
    rules,
    duration: effectiveDuration,
    slotInterval: service.slotInterval,
    beforeBuffer: service.beforeEventBuffer,
    afterBuffer: service.afterEventBuffer,
    minimumNotice: service.minimumBookingNotice,
    busy,
    now,
  });

  // Group events: a slot that already has same-service bookings stays open
  // (for the same duration) until its seats are filled.
  const seats = service.seatsPerSlot ?? 1;
  if (seats > 1) {
    const wantedEnd = effectiveDuration * 60_000;
    const groupCounts = new Map<string, number>();
    for (const row of busyRows) {
      if (row.serviceId !== service.id) continue;
      if (row.endTime.getTime() - row.startTime.getTime() !== wantedEnd) continue;
      const key = row.startTime.toISOString();
      groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    }
    const nowMs = (now ?? new Date()).getTime() + service.minimumBookingNotice * 60_000;
    const have = new Set(slots.map((slot) => slot.time));
    for (const [iso, taken] of groupCounts) {
      const startMs = new Date(iso).getTime();
      if (taken >= seats || have.has(iso)) continue;
      if (startMs < nowMs || startMs < rangeStart.getTime() || startMs >= rangeEnd.getTime()) continue;
      slots.push({ time: iso });
    }
    slots.sort((a, b) => a.time.localeCompare(b.time));
  }

  // Daily cap: stop offering slots on days that already hit the service's
  // booking limit (counted service-wide, in the schedule's timezone).
  if (service.maxBookingsPerDay) {
    const dayCounts = new Map<string, number>();
    const serviceBookings = await db
      .select({ startTime: bookings.startTime })
      .from(bookings)
      .where(
        and(
          eq(bookings.serviceId, service.id),
          inArray(bookings.status, ["accepted", "pending"]),
          lt(bookings.startTime, rangeEnd),
          gte(bookings.endTime, rangeStart),
        ),
      );
    for (const row of serviceBookings) {
      const key = formatDateKey(row.startTime, service.scheduleTimeZone);
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    }
    slots = slots.filter((slot) => {
      const key = formatDateKey(new Date(slot.time), service.scheduleTimeZone);
      return (dayCounts.get(key) ?? 0) < service.maxBookingsPerDay!;
    });
  }

  return slots;
}

/**
 * Check whether a provider already has an overlapping booking. When `groupJoin`
 * is given, bookings of the same service at the exact same time don't conflict
 * until the slot's seats are filled.
 */
export async function hostHasConflict(
  providerId: number,
  start: Date,
  end: Date,
  groupJoin?: { serviceId: number; seats: number },
): Promise<boolean> {
  const rows = await db
    .select({ id: bookings.id, serviceId: bookings.serviceId, startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, providerId),
        inArray(bookings.status, ["accepted", "pending"]),
        lt(bookings.startTime, end),
        gt(bookings.endTime, start),
      ),
    );
  if (!groupJoin || groupJoin.seats <= 1) return rows.length > 0;

  let sameSlot = 0;
  for (const row of rows) {
    const isGroupMate =
      row.serviceId === groupJoin.serviceId &&
      row.startTime.getTime() === start.getTime() &&
      row.endTime.getTime() === end.getTime();
    if (!isGroupMate) return true;
    sameSlot += 1;
  }
  return sameSlot >= groupJoin.seats;
}
