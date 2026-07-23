import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { serviceProviders, bookings, users, availabilities, services } from "@/db/schema";
import { computeSlots, type AvailabilityRule } from "@/lib/slots";
import { fetchBusyTimes } from "@/server/calendar";
import { hostHasConflict } from "@/server/availability";

interface HostRow {
  userId: number;
  timeZone: string;
  defaultScheduleId: number | null;
}

async function loadHosts(serviceId: number): Promise<HostRow[]> {
  return db
    .select({
      userId: serviceProviders.userId,
      timeZone: users.timeZone,
      defaultScheduleId: users.defaultScheduleId,
    })
    .from(serviceProviders)
    .innerJoin(users, eq(serviceProviders.userId, users.id))
    .where(eq(serviceProviders.serviceId, serviceId));
}

async function isHostFree(
  host: HostRow,
  start: Date,
  end: Date,
  groupJoin?: { serviceId: number; seats: number },
): Promise<boolean> {
  const conflict = await hostHasConflict(host.userId, start, end, groupJoin);
  if (conflict || !host.defaultScheduleId) return false;

  const externalBusy = await fetchBusyTimes(host.userId, start, end);
  if (externalBusy.some((slot) => new Date(slot.start) < end && new Date(slot.end) > start)) return false;

  const rules = await db
    .select()
    .from(availabilities)
    .where(eq(availabilities.scheduleId, host.defaultScheduleId));
  const mapped: AvailabilityRule[] = rules.map((rule) => ({
    days: rule.days,
    date: rule.date,
    startTime: rule.startTime,
    endTime: rule.endTime,
  }));
  const duration = Math.round((end.getTime() - start.getTime()) / 60_000);
  return computeSlots({
    rangeStart: new Date(start.getTime() - 60_000),
    rangeEnd: new Date(end.getTime() + 60_000),
    scheduleTimeZone: host.timeZone,
    rules: mapped,
    duration,
    minimumNotice: 0,
    busy: [],
  }).some((slot) => slot.time === start.toISOString());
}

async function loadHostLoads(userIds: number[]): Promise<Record<number, { total: number; upcoming: number }>> {
  const loads: Record<number, { total: number; upcoming: number }> = {};
  for (const id of userIds) loads[id] = { total: 0, upcoming: 0 };
  if (userIds.length === 0) return loads;

  const rows = await db
    .select({
      userId: bookings.userId,
      total: sql<number>`count(*)::int`,
      upcoming: sql<number>`count(*) filter (where ${bookings.startTime} > now())::int`,
    })
    .from(bookings)
    .where(and(inArray(bookings.userId, userIds), inArray(bookings.status, ["accepted", "pending"])))
    .groupBy(bookings.userId);
  for (const row of rows) {
    if (row.userId != null) loads[row.userId] = { total: row.total, upcoming: row.upcoming };
  }
  return loads;
}

/** Select exactly one available provider for a company service. */
export async function assignTeamHost(
  serviceId: number,
  start: Date,
  end: Date,
  preferredHostId?: number | null,
): Promise<number | null> {
  const hosts = await loadHosts(serviceId);
  if (hosts.length === 0) return null;

  const [svc] = await db
    .select({ seatsPerSlot: services.seatsPerSlot })
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);
  const seats = svc?.seatsPerSlot ?? 1;
  const groupJoin = seats > 1 ? { serviceId, seats } : undefined;

  // Group events must land every attendee on the SAME provider: when a group
  // slot is already open at this exact time, join it while seats remain.
  if (groupJoin) {
    const existing = await db
      .select({ userId: bookings.userId, count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(
        eq(bookings.serviceId, serviceId),
        inArray(bookings.status, ["accepted", "pending"]),
        eq(bookings.startTime, start),
        eq(bookings.endTime, end),
      ))
      .groupBy(bookings.userId);
    const open = existing.find((row) => row.userId !== null && row.count < seats);
    if (open?.userId != null && (preferredHostId == null || preferredHostId === open.userId)) {
      return open.userId;
    }
  }

  const availability = await Promise.all(hosts.map((host) => isHostFree(host, start, end, groupJoin)));

  if (preferredHostId != null) {
    const index = hosts.findIndex((host) => host.userId === preferredHostId);
    return index >= 0 && availability[index] ? preferredHostId : null;
  }

  const loads = await loadHostLoads(hosts.map((host) => host.userId));
  const availableHosts = hosts.filter((_, index) => availability[index]);
  availableHosts.sort((a, b) =>
    (loads[a.userId]?.upcoming ?? 0) - (loads[b.userId]?.upcoming ?? 0) ||
    (loads[a.userId]?.total ?? 0) - (loads[b.userId]?.total ?? 0) ||
    a.userId - b.userId,
  );
  return availableHosts[0]?.userId ?? null;
}
