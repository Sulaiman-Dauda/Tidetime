"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { schedules, availabilities, memberships, users } from "@/db/schema";
import { requireAnyPermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
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
  targetUserId: z.number().int().positive().optional(),
});

export type SaveScheduleInput = z.infer<typeof saveSchema>;
export type SaveScheduleResult = { ok: true } | { ok: false; error: string };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Resolve whose availability is being managed. Members manage their own;
 * owners/admins may manage any accepted member of their company.
 */
async function resolveTarget(targetUserId?: number) {
  const { user, role, teamId } = await requireAnyPermission([
    "availability.own.manage",
    "availability.all.manage",
  ]);
  if (!targetUserId || targetUserId === user.id) {
    if (!can(role, "availability.own.manage") && !can(role, "availability.all.manage")) return null;
    return { actor: user, target: user };
  }
  if (!can(role, "availability.all.manage")) return null;
  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(
      eq(memberships.userId, targetUserId),
      eq(memberships.teamId, teamId),
      eq(memberships.accepted, true),
    ))
    .limit(1);
  if (!membership) return null;
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  return target ? { actor: user, target } : null;
}

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
  const data = saveSchema.parse(input);
  const resolved = await resolveTarget(data.targetUserId);
  if (!resolved) return { ok: false, error: "You can't manage this schedule" };
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
    .where(and(eq(schedules.id, data.scheduleId), eq(schedules.userId, resolved.target.id)))
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
  const targetUserId = Number(formData.get("targetUserId")) || undefined;
  const resolved = await resolveTarget(targetUserId);
  if (!resolved) return { ok: false, error: "You can't manage this schedule" };
  const id = Number(formData.get("scheduleId"));

  const all = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.userId, resolved.target.id));
  if (!all.some((s) => s.id === id)) return { ok: false, error: "Schedule not found" };
  // A provider without any schedule silently offers zero public slots — never
  // allow deleting the last one.
  if (all.length <= 1) {
    return { ok: false, error: "You can't delete the only schedule. Create another one first." };
  }

  const replacement = all.find((s) => s.id !== id)!;
  await db.transaction(async (tx) => {
    await tx.delete(schedules).where(and(eq(schedules.id, id), eq(schedules.userId, resolved.target.id)));
    // Repoint the default so availability resolution never dangles.
    await tx
      .update(users)
      .set({ defaultScheduleId: replacement.id })
      .where(and(eq(users.id, resolved.target.id), eq(users.defaultScheduleId, id)));
  });
  revalidatePath("/dashboard/availability");
  return { ok: true };
}

/** Create a schedule with sensible 9–5 weekday hours; becomes the default when
 *  the user doesn't have one. Recovers the "no schedule" dead end. */
export async function createScheduleAction(formData?: FormData): Promise<{ ok: boolean; id?: number }> {
  const targetUserId = formData ? Number(formData.get("targetUserId")) || undefined : undefined;
  const resolved = await resolveTarget(targetUserId);
  if (!resolved) return { ok: false };
  const target = resolved.target;

  const existing = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.userId, target.id));

  let createdId = 0;
  await db.transaction(async (tx) => {
    const [schedule] = await tx
      .insert(schedules)
      .values({
        userId: target.id,
        name: existing.length === 0 ? "Working Hours" : `Schedule ${existing.length + 1}`,
        timeZone: target.timeZone,
      })
      .returning({ id: schedules.id });
    createdId = schedule.id;
    await tx.insert(availabilities).values({
      scheduleId: schedule.id,
      days: [1, 2, 3, 4, 5],
      startTime: "09:00:00",
      endTime: "17:00:00",
    });
    if (!target.defaultScheduleId) {
      await tx.update(users).set({ defaultScheduleId: schedule.id }).where(eq(users.id, target.id));
    }
  });
  revalidatePath("/dashboard/availability");
  return { ok: true, id: createdId };
}

/** Copy a schedule with all its weekly rules and date overrides. */
export async function duplicateScheduleAction(formData: FormData): Promise<{ ok: boolean; id?: number }> {
  const targetUserId = Number(formData.get("targetUserId")) || undefined;
  const resolved = await resolveTarget(targetUserId);
  if (!resolved) return { ok: false };
  const id = Number(formData.get("scheduleId"));

  const [original] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.userId, resolved.target.id)))
    .limit(1);
  if (!original) return { ok: false };
  const rules = await db.select().from(availabilities).where(eq(availabilities.scheduleId, id));

  let createdId = 0;
  await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(schedules)
      .values({ userId: resolved.target.id, name: `${original.name} copy`, timeZone: original.timeZone })
      .returning({ id: schedules.id });
    createdId = copy.id;
    if (rules.length > 0) {
      await tx.insert(availabilities).values(
        rules.map((rule) => ({
          scheduleId: copy.id,
          days: rule.days,
          date: rule.date,
          startTime: rule.startTime,
          endTime: rule.endTime,
        })),
      );
    }
  });
  revalidatePath("/dashboard/availability");
  return { ok: true, id: createdId };
}

/** Point public availability at a different schedule. */
export async function setDefaultScheduleAction(formData: FormData): Promise<{ ok: boolean }> {
  const targetUserId = Number(formData.get("targetUserId")) || undefined;
  const resolved = await resolveTarget(targetUserId);
  if (!resolved) return { ok: false };
  const id = Number(formData.get("scheduleId"));

  const [owned] = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(and(eq(schedules.id, id), eq(schedules.userId, resolved.target.id)))
    .limit(1);
  if (!owned) return { ok: false };
  await db.update(users).set({ defaultScheduleId: id }).where(eq(users.id, resolved.target.id));
  revalidatePath("/dashboard/availability");
  return { ok: true };
}

