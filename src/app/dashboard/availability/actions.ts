"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { schedules, availabilities, users } from "@/db/schema";
import { requirePermission } from "@/lib/guard";
import { isValidTimeZone } from "@/lib/time";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const ruleSchema = z.object({
  day: z.number().min(0).max(6),
  intervals: z.array(z.object({ start: z.string().regex(TIME), end: z.string().regex(TIME) })),
});

const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  intervals: z.array(z.object({ start: z.string().regex(TIME), end: z.string().regex(TIME) })),
});

const saveSchema = z.object({
  scheduleId: z.coerce.number(),
  name: z.string().trim().min(1).max(128),
  timeZone: z.string(),
  weekly: z.array(ruleSchema),
  overrides: z.array(overrideSchema),
});

export type SaveScheduleInput = z.infer<typeof saveSchema>;
export type SaveScheduleResult = { ok: true } | { ok: false; error: string };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** First problem found in a day's intervals, or null. Rejecting beats silently dropping. */
function intervalProblem(label: string, intervals: { start: string; end: string }[]): string | null {
  const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));
  for (const iv of sorted) {
    if (iv.end <= iv.start) return `${label}: ${iv.start}–${iv.end} ends before it starts`;
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      return `${label}: ${sorted[i - 1].start}–${sorted[i - 1].end} overlaps ${sorted[i].start}–${sorted[i].end}`;
    }
  }
  return null;
}

export async function saveScheduleAction(input: SaveScheduleInput): Promise<SaveScheduleResult> {
  const { user } = await requirePermission("availability.own.manage");
  const data = saveSchema.parse(input);
  const tz = isValidTimeZone(data.timeZone) ? data.timeZone : "UTC";

  for (const rule of data.weekly) {
    const problem = intervalProblem(DAY_NAMES[rule.day] ?? "Day", rule.intervals);
    if (problem) return { ok: false, error: problem };
  }
  for (const ov of data.overrides) {
    const problem = intervalProblem(ov.date, ov.intervals);
    if (problem) return { ok: false, error: problem };
  }

  // Verify ownership.
  const [owned] = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(and(eq(schedules.id, data.scheduleId), eq(schedules.userId, user.id)))
    .limit(1);
  if (!owned) return { ok: false, error: "Schedule not found — it may have been deleted." };

  await db.update(schedules).set({ name: data.name, timeZone: tz }).where(eq(schedules.id, data.scheduleId));

  // Rewrite availability rows transactionally.
  await db.transaction(async (tx) => {
    await tx.delete(availabilities).where(eq(availabilities.scheduleId, data.scheduleId));

    const rows: (typeof availabilities.$inferInsert)[] = [];
    for (const rule of data.weekly) {
      for (const iv of rule.intervals) {
        rows.push({
          scheduleId: data.scheduleId,
          days: [rule.day],
          startTime: `${iv.start}:00`,
          endTime: `${iv.end}:00`,
        });
      }
    }
    for (const ov of data.overrides) {
      if (ov.intervals.length === 0) {
        // Day marked unavailable.
        rows.push({ scheduleId: data.scheduleId, days: [], date: ov.date, startTime: null, endTime: null });
      } else {
        for (const iv of ov.intervals) {
          rows.push({
            scheduleId: data.scheduleId,
            days: [],
            date: ov.date,
            startTime: `${iv.start}:00`,
            endTime: `${iv.end}:00`,
          });
        }
      }
    }
    if (rows.length > 0) await tx.insert(availabilities).values(rows);
  });

  revalidatePath("/dashboard/availability");
  return { ok: true };
}

export type DeleteScheduleResult = { ok: true } | { ok: false; error: string };

export async function deleteScheduleAction(formData: FormData): Promise<DeleteScheduleResult> {
  const { user } = await requirePermission("availability.own.manage");
  const id = Number(formData.get("scheduleId"));

  const all = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.userId, user.id));
  if (!all.some((s) => s.id === id)) return { ok: false, error: "Schedule not found" };
  // A provider without any schedule silently offers zero public slots — never
  // allow deleting the last one.
  if (all.length <= 1) {
    return { ok: false, error: "You can't delete your only schedule. Create another one first." };
  }

  const replacement = all.find((s) => s.id !== id)!;
  await db.transaction(async (tx) => {
    await tx.delete(schedules).where(and(eq(schedules.id, id), eq(schedules.userId, user.id)));
    // Repoint the default so availability resolution never dangles.
    await tx
      .update(users)
      .set({ defaultScheduleId: replacement.id })
      .where(and(eq(users.id, user.id), eq(users.defaultScheduleId, id)));
  });
  revalidatePath("/dashboard/availability");
  return { ok: true };
}

/** Create a schedule with sensible 9–5 weekday hours and make it the default
 *  if the user doesn't have one. Recovers the "no schedule" dead end. */
export async function createScheduleAction(): Promise<{ ok: boolean }> {
  const { user } = await requirePermission("availability.own.manage");
  await db.transaction(async (tx) => {
    const [schedule] = await tx
      .insert(schedules)
      .values({ userId: user.id, name: "Working Hours", timeZone: user.timeZone })
      .returning({ id: schedules.id });
    await tx.insert(availabilities).values({
      scheduleId: schedule.id,
      days: [1, 2, 3, 4, 5],
      startTime: "09:00:00",
      endTime: "17:00:00",
    });
    if (!user.defaultScheduleId) {
      await tx.update(users).set({ defaultScheduleId: schedule.id }).where(eq(users.id, user.id));
    }
  });
  revalidatePath("/dashboard/availability");
  return { ok: true };
}
