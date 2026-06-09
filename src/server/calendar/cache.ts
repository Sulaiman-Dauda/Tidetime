import "server-only";
import { and, desc, eq, gt, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { calendarCache } from "@/db/schema";
import type { BusyInterval } from "./types";

/** How long a cached busy-window stays fresh. External calendars can change
 * out from under us, so this is deliberately short — it absorbs the burst of
 * repeated slot queries from a single booking session, not long-term drift. */
export const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

/** Keep only intervals that overlap the requested window. Pure — unit tested. */
export function busyWithinRange(
  busy: BusyInterval[],
  rangeStart: Date,
  rangeEnd: Date,
): BusyInterval[] {
  const s = rangeStart.getTime();
  const e = rangeEnd.getTime();
  return busy.filter((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return Number.isFinite(bs) && Number.isFinite(be) && be > s && bs < e;
  });
}

/**
 * Return cached busy-times if a non-expired row fully covers [rangeStart,
 * rangeEnd], else null. The covering check lets a single wide cache row serve
 * many narrower queries.
 */
export async function readBusyCache(
  userId: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusyInterval[] | null> {
  const [row] = await db
    .select({ busy: calendarCache.busy })
    .from(calendarCache)
    .where(
      and(
        eq(calendarCache.userId, userId),
        lte(calendarCache.rangeStart, rangeStart),
        gte(calendarCache.rangeEnd, rangeEnd),
        gt(calendarCache.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(calendarCache.createdAt))
    .limit(1);
  if (!row) return null;
  return busyWithinRange(row.busy, rangeStart, rangeEnd);
}

/** Store the merged busy-times for a window and prune this user's stale rows. */
export async function writeBusyCache(
  userId: number,
  rangeStart: Date,
  rangeEnd: Date,
  busy: BusyInterval[],
): Promise<void> {
  await db.transaction(async (tx) => {
    // Prune expired rows for this user so the table can't grow without bound.
    await tx
      .delete(calendarCache)
      .where(and(eq(calendarCache.userId, userId), lte(calendarCache.expiresAt, new Date())));
    await tx.insert(calendarCache).values({
      userId,
      rangeStart,
      rangeEnd,
      busy,
      expiresAt: new Date(Date.now() + CALENDAR_CACHE_TTL_MS),
    });
  });
}

/** Drop every cached window for a user. Called whenever their calendar changes. */
export async function invalidateCalendarCache(userId: number): Promise<void> {
  await db.delete(calendarCache).where(eq(calendarCache.userId, userId));
}
