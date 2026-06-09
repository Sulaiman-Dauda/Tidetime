import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { travelSchedules, type TravelSchedule } from "@/db/schema";
import { isValidTimeZone } from "@/lib/time";

/** A user's travel periods, soonest first. */
export function listTravelSchedules(userId: number): Promise<TravelSchedule[]> {
  return db
    .select()
    .from(travelSchedules)
    .where(eq(travelSchedules.userId, userId))
    .orderBy(asc(travelSchedules.startDate));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function addTravelSchedule(
  userId: number,
  input: { timeZone: string; startDate: string; endDate: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidTimeZone(input.timeZone)) return { ok: false, error: "Invalid timezone" };
  if (!DATE_RE.test(input.startDate) || !DATE_RE.test(input.endDate)) {
    return { ok: false, error: "Invalid dates" };
  }
  if (input.endDate < input.startDate) return { ok: false, error: "End date is before start date" };
  await db.insert(travelSchedules).values({
    userId,
    timeZone: input.timeZone,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  return { ok: true };
}

export async function deleteTravelSchedule(userId: number, id: number): Promise<void> {
  await db
    .delete(travelSchedules)
    .where(and(eq(travelSchedules.id, id), eq(travelSchedules.userId, userId)));
}
