"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { schedules, availabilities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
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

export async function saveScheduleAction(input: SaveScheduleInput) {
  const user = await requireUser();
  const data = saveSchema.parse(input);
  const tz = isValidTimeZone(data.timeZone) ? data.timeZone : "UTC";

  // Verify ownership.
  const [owned] = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(and(eq(schedules.id, data.scheduleId), eq(schedules.userId, user.id)))
    .limit(1);
  if (!owned) throw new Error("NOT_FOUND");

  await db.update(schedules).set({ name: data.name, timeZone: tz }).where(eq(schedules.id, data.scheduleId));

  // Rewrite availability rows transactionally.
  await db.transaction(async (tx) => {
    await tx.delete(availabilities).where(eq(availabilities.scheduleId, data.scheduleId));

    const rows: (typeof availabilities.$inferInsert)[] = [];
    for (const rule of data.weekly) {
      for (const iv of rule.intervals) {
        if (iv.end <= iv.start) continue;
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
          if (iv.end <= iv.start) continue;
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

export async function createScheduleAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || "New schedule";
  await db.insert(schedules).values({ userId: user.id, name, timeZone: user.timeZone });
  revalidatePath("/dashboard/availability");
}
