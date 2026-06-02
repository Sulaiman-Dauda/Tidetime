import "server-only";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { blockedPeriods } from "@/db/schema";

export type BlockedPeriod = typeof blockedPeriods.$inferSelect;

/** List instance-wide blocked periods, optionally only those ending in the future. */
export async function listBlockedPeriods(opts?: { upcomingOnly?: boolean }): Promise<BlockedPeriod[]> {
  const filters = [isNull(blockedPeriods.teamId)];
  if (opts?.upcomingOnly) filters.push(gte(blockedPeriods.end, new Date()));
  return db
    .select()
    .from(blockedPeriods)
    .where(and(...filters))
    .orderBy(asc(blockedPeriods.start));
}

/** Create an instance-wide blocked period. Returns null if the range is invalid. */
export async function createBlockedPeriod(input: {
  start: Date;
  end: Date;
  reason?: string | null;
}): Promise<BlockedPeriod | null> {
  if (input.end.getTime() <= input.start.getTime()) return null;
  const [row] = await db
    .insert(blockedPeriods)
    .values({ start: input.start, end: input.end, reason: input.reason ?? null })
    .returning();
  return row ?? null;
}

/** Delete an instance-wide blocked period by id. */
export async function deleteBlockedPeriod(id: number): Promise<void> {
  await db.delete(blockedPeriods).where(and(eq(blockedPeriods.id, id), isNull(blockedPeriods.teamId)));
}
