import "server-only";
import { and, eq, gte, inArray, lt, desc, or } from "drizzle-orm";
import { db } from "@/db";
import {
  resources,
  eventTypeResources,
  bookingResources,
  bookings,
  type Resource,
  type NewResource,
} from "@/db/schema";
import {
  busyIntervalsAtCapacity,
  hasResourceCapacity,
  type Interval,
} from "@/lib/resources";

export interface ResourceOwner {
  userId: number;
  teamIds?: number[];
}

/** List resources owned by a user (and optionally their teams). */
export async function listResources(owner: ResourceOwner): Promise<Resource[]> {
  const scopes = [eq(resources.userId, owner.userId)];
  if (owner.teamIds && owner.teamIds.length > 0) {
    scopes.push(inArray(resources.teamId, owner.teamIds));
  }
  return db
    .select()
    .from(resources)
    .where(or(...scopes))
    .orderBy(desc(resources.createdAt));
}

export async function createResource(input: NewResource): Promise<Resource> {
  const [row] = await db.insert(resources).values(input).returning();
  return row;
}

/**
 * Count how many event types reference each given resource. Used by the
 * dashboard to show where a shared asset is in play (the "person + place +
 * equipment" wedge). Returns a map keyed by resourceId.
 */
export async function eventTypeUsageCounts(
  resourceIds: number[],
): Promise<Record<number, number>> {
  if (resourceIds.length === 0) return {};
  const rows = await db
    .select({ resourceId: eventTypeResources.resourceId })
    .from(eventTypeResources)
    .where(inArray(eventTypeResources.resourceId, resourceIds));
  const counts: Record<number, number> = {};
  for (const r of rows) counts[r.resourceId] = (counts[r.resourceId] ?? 0) + 1;
  return counts;
}

export async function updateResource(
  id: number,
  userId: number,
  patch: Partial<NewResource>,
): Promise<Resource | null> {
  const [row] = await db
    .update(resources)
    .set(patch)
    .where(and(eq(resources.id, id), eq(resources.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteResource(id: number, userId: number): Promise<boolean> {
  const [row] = await db
    .delete(resources)
    .where(and(eq(resources.id, id), eq(resources.userId, userId)))
    .returning({ id: resources.id });
  return Boolean(row);
}

/** Required resources (with capacity) attached to an event type. */
export async function getEventTypeResources(
  eventTypeId: number,
): Promise<{ resourceId: number; capacity: number; required: boolean }[]> {
  return db
    .select({
      resourceId: resources.id,
      capacity: resources.capacity,
      required: eventTypeResources.required,
    })
    .from(eventTypeResources)
    .innerJoin(resources, eq(eventTypeResources.resourceId, resources.id))
    .where(and(eq(eventTypeResources.eventTypeId, eventTypeId), eq(resources.active, true)));
}

/** Replace the resource links for an event type. */
export async function setEventTypeResources(
  eventTypeId: number,
  resourceIds: number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(eventTypeResources).where(eq(eventTypeResources.eventTypeId, eventTypeId));
    if (resourceIds.length > 0) {
      await tx
        .insert(eventTypeResources)
        .values(resourceIds.map((resourceId) => ({ eventTypeId, resourceId })));
    }
  });
}

/** Existing reservations for a set of resources within a window, by resource. */
async function loadResourceReservations(
  resourceIds: number[],
  rangeStart: Date,
  rangeEnd: Date,
  excludeBookingId?: number,
): Promise<Map<number, Interval[]>> {
  const map = new Map<number, Interval[]>();
  if (resourceIds.length === 0) return map;

  const rows = await db
    .select({
      resourceId: bookingResources.resourceId,
      bookingId: bookings.id,
      start: bookings.startTime,
      end: bookings.endTime,
    })
    .from(bookingResources)
    .innerJoin(bookings, eq(bookingResources.bookingId, bookings.id))
    .where(
      and(
        inArray(bookingResources.resourceId, resourceIds),
        inArray(bookings.status, ["accepted", "pending"]),
        lt(bookings.startTime, rangeEnd),
        gte(bookings.endTime, rangeStart),
      ),
    );

  for (const r of rows) {
    if (excludeBookingId && r.bookingId === excludeBookingId) continue;
    const list = map.get(r.resourceId) ?? [];
    list.push({ start: r.start.getTime(), end: r.end.getTime() });
    map.set(r.resourceId, list);
  }
  return map;
}

/**
 * Busy windows the slot engine must subtract: for each required resource,
 * the times where it is already at capacity.
 */
export async function resourceBusyIntervals(
  eventTypeId: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Interval[]> {
  const required = (await getEventTypeResources(eventTypeId)).filter((r) => r.required);
  if (required.length === 0) return [];

  const reservations = await loadResourceReservations(
    required.map((r) => r.resourceId),
    rangeStart,
    rangeEnd,
  );

  const out: Interval[] = [];
  for (const res of required) {
    const existing = reservations.get(res.resourceId) ?? [];
    out.push(...busyIntervalsAtCapacity(existing, res.capacity));
  }
  return out;
}

/**
 * Race-safe booking-time reservation. Verifies every required resource still
 * has capacity for [start,end) and, if so, links them to the booking.
 * Returns false on conflict (caller should roll the booking back).
 */
export async function reserveResourcesForBooking(
  bookingId: number,
  eventTypeId: number,
  start: Date,
  end: Date,
): Promise<boolean> {
  const required = (await getEventTypeResources(eventTypeId)).filter((r) => r.required);
  if (required.length === 0) return true;

  const candidate: Interval = { start: start.getTime(), end: end.getTime() };
  const reservations = await loadResourceReservations(
    required.map((r) => r.resourceId),
    start,
    end,
    bookingId,
  );

  for (const res of required) {
    const existing = reservations.get(res.resourceId) ?? [];
    if (!hasResourceCapacity(existing, candidate, res.capacity)) {
      return false;
    }
  }

  await db
    .insert(bookingResources)
    .values(required.map((r) => ({ bookingId, resourceId: r.resourceId })))
    .onConflictDoNothing();
  return true;
}
