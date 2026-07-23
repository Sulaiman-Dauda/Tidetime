import "server-only";
import { and, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { availabilities, bookings, type Service } from "@/db/schema";
import { computeSlots, type AvailabilityRule, type Interval, type Slot } from "@/lib/slots";
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

async function loadBusy(
  providerId: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Interval[]> {
  const rows = await db
    .select({ startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, providerId),
        inArray(bookings.status, ["accepted", "pending"]),
        lt(bookings.startTime, rangeEnd),
        gte(bookings.endTime, rangeStart),
      ),
    );
  return rows.map((row) => ({
    start: row.startTime.getTime(),
    end: row.endTime.getTime(),
  }));
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

  const busy = await loadBusy(service.providerId, rangeStart, rangeEnd);
  const externalBusy = await fetchBusyTimes(service.providerId, rangeStart, rangeEnd);
  for (const item of externalBusy) {
    busy.push({
      start: new Date(item.start).getTime(),
      end: new Date(item.end).getTime(),
    });
  }

  return computeSlots({
    rangeStart,
    rangeEnd,
    scheduleTimeZone: service.scheduleTimeZone,
    rules,
    duration: duration ?? service.length,
    slotInterval: service.slotInterval,
    beforeBuffer: service.beforeEventBuffer,
    afterBuffer: service.afterEventBuffer,
    minimumNotice: service.minimumBookingNotice,
    busy,
    now,
  });
}

/** Check whether a provider already has an overlapping booking. */
export async function hostHasConflict(
  providerId: number,
  start: Date,
  end: Date,
): Promise<boolean> {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, providerId),
        inArray(bookings.status, ["accepted", "pending"]),
        lt(bookings.startTime, end),
        gt(bookings.endTime, start),
      ),
    )
    .limit(1);
  return Boolean(row);
}
