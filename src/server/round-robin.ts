import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  eventTypeHosts,
  bookings,
  users,
  availabilities,
  outOfOffice,
} from "@/db/schema";
import {
  selectRoundRobinHost,
  selectCollectiveHosts,
  type RRHost,
  type RoundRobinMode,
} from "@/lib/round-robin";
import { computeSlots, type AvailabilityRule } from "@/lib/slots";

/** Map a service's stored round-robin distribution to the engine mode. */
function resolveMode(value: unknown): RoundRobinMode {
  return value === "least_busy" || value === "random" ? value : "sequential";
}

interface HostRow {
  userId: number;
  isFixed: boolean;
  priority: number;
  weight: number;
  timeZone: string;
  defaultScheduleId: number | null;
}

async function loadHostRows(eventTypeId: number): Promise<HostRow[]> {
  return db
    .select({
      userId: eventTypeHosts.userId,
      isFixed: eventTypeHosts.isFixed,
      priority: eventTypeHosts.priority,
      weight: eventTypeHosts.weight,
      timeZone: users.timeZone,
      defaultScheduleId: users.defaultScheduleId,
    })
    .from(eventTypeHosts)
    .innerJoin(users, eq(eventTypeHosts.userId, users.id))
    .where(eq(eventTypeHosts.eventTypeId, eventTypeId));
}

/** Is a single host free for [start, end)? Checks bookings, OOO and schedule. */
async function isHostFree(
  host: HostRow,
  start: Date,
  end: Date,
  scheduleTimeZone: string,
): Promise<boolean> {
  // Conflicting confirmed/pending booking?
  const [conflict] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, host.userId),
        inArray(bookings.status, ["accepted", "pending"]),
        lt(bookings.startTime, end),
        gte(bookings.endTime, start),
      ),
    )
    .limit(1);
  if (conflict) return false;

  // Out-of-office overlap?
  const [ooo] = await db
    .select({ id: outOfOffice.id })
    .from(outOfOffice)
    .where(
      and(
        eq(outOfOffice.userId, host.userId),
        lt(outOfOffice.start, end),
        gte(outOfOffice.end, start),
      ),
    )
    .limit(1);
  if (ooo) return false;

  // Inside the host's working hours? Reuse the slot engine for a 1-slot window.
  if (!host.defaultScheduleId) return false;
  const rules = await db
    .select()
    .from(availabilities)
    .where(eq(availabilities.scheduleId, host.defaultScheduleId));
  const mapped: AvailabilityRule[] = rules.map((r) => ({
    days: r.days,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
  }));
  const duration = Math.round((end.getTime() - start.getTime()) / 60000);
  const slots = computeSlots({
    rangeStart: new Date(start.getTime() - 60000),
    rangeEnd: new Date(end.getTime() + 60000),
    scheduleTimeZone,
    rules: mapped,
    duration,
    minimumNotice: 0,
    busy: [],
  });
  return slots.some((s) => s.time === start.toISOString());
}

/** Lifetime + upcoming booking counts for a set of hosts, in one query each. */
async function loadHostLoads(
  userIds: number[],
): Promise<Record<number, { total: number; upcoming: number }>> {
  const out: Record<number, { total: number; upcoming: number }> = {};
  for (const id of userIds) out[id] = { total: 0, upcoming: 0 };
  if (userIds.length === 0) return out;

  const rows = await db
    .select({
      userId: bookings.userId,
      total: sql<number>`count(*)::int`,
      upcoming: sql<number>`count(*) filter (where ${bookings.startTime} > now())::int`,
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.userId, userIds),
        inArray(bookings.status, ["accepted", "pending"]),
      ),
    )
    .groupBy(bookings.userId);

  for (const r of rows) {
    if (r.userId != null) out[r.userId] = { total: r.total, upcoming: r.upcoming };
  }
  return out;
}

export interface AssignmentResult {
  /** primary host who owns the booking */
  hostUserId: number;
  /** additional fixed/collective hosts (for collective events) */
  coHostUserIds: number[];
}

/**
 * Choose the host(s) for a team service at a specific slot.
 *
 * - `round_robin`: one rotating host (plus any fixed hosts) chosen by the
 *   configured distribution mode, only among hosts free for the slot.
 * - `collective`: every host must be free; all are attached.
 * Returns `null` if no valid assignment exists for the slot.
 */
export async function assignTeamHosts(
  eventTypeId: number,
  schedulingType: "round_robin" | "collective" | "managed",
  distributionMode: unknown,
  start: Date,
  end: Date,
  scheduleTimeZone: string,
): Promise<AssignmentResult | null> {
  const hostRows = await loadHostRows(eventTypeId);
  if (hostRows.length === 0) return null;

  // Determine availability for each host concurrently.
  const availability = await Promise.all(
    hostRows.map((h) => isHostFree(h, start, end, scheduleTimeZone)),
  );

  if (schedulingType === "collective") {
    const ids = selectCollectiveHosts(
      hostRows.map((h, i) => ({ userId: h.userId, available: availability[i] })),
    );
    if (!ids) return null;
    return { hostUserId: ids[0], coHostUserIds: ids.slice(1) };
  }

  // round_robin (managed treated like round_robin for assignment)
  const fixed = hostRows.filter((h) => h.isFixed);
  const rotating = hostRows.filter((h) => !h.isFixed);

  // All fixed hosts must be available.
  for (const f of fixed) {
    const idx = hostRows.indexOf(f);
    if (!availability[idx]) return null;
  }

  const loads = await loadHostLoads(rotating.map((h) => h.userId));
  const pool: RRHost[] = rotating.map((h) => {
    const idx = hostRows.indexOf(h);
    return {
      userId: h.userId,
      weight: h.weight,
      priority: h.priority,
      available: availability[idx],
      totalAssigned: loads[h.userId]?.total ?? 0,
      upcomingLoad: loads[h.userId]?.upcoming ?? 0,
    };
  });

  // If there are no rotating hosts, fall back to the fixed hosts only.
  if (pool.length === 0) {
    if (fixed.length === 0) return null;
    return { hostUserId: fixed[0].userId, coHostUserIds: fixed.slice(1).map((h) => h.userId) };
  }

  const picked = selectRoundRobinHost({ mode: resolveMode(distributionMode), hosts: pool });
  if (!picked) return null;

  return {
    hostUserId: picked.userId,
    coHostUserIds: fixed.map((h) => h.userId),
  };
}

export { resolveMode };
