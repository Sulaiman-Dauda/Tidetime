import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { schedules, availabilities } from "@/db/schema";
import { AvailabilityEditor, type WeeklyRule, type DateOverride } from "./editor";

export default async function AvailabilityPage() {
  const user = (await getCurrentUser())!;

  // Use the default schedule, or the first one.
  const all = await db.select().from(schedules).where(eq(schedules.userId, user.id));
  const active = all.find((s) => s.id === user.defaultScheduleId) ?? all[0];

  const rows = active
    ? await db.select().from(availabilities).where(eq(availabilities.scheduleId, active.id))
    : [];

  // Build weekly + overrides view models.
  const weekly: WeeklyRule[] = Array.from({ length: 7 }, (_, day) => ({ day, intervals: [] }));
  const overridesMap = new Map<string, DateOverride>();

  for (const r of rows) {
    if (r.date) {
      const existing = overridesMap.get(r.date) ?? { date: r.date, intervals: [] };
      if (r.startTime && r.endTime) {
        existing.intervals.push({ start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) });
      }
      overridesMap.set(r.date, existing);
    } else if (r.startTime && r.endTime) {
      for (const d of r.days) {
        weekly[d]?.intervals.push({ start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) });
      }
    }
  }

  const overrides = Array.from(overridesMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-8">
      <AvailabilityEditor
        schedule={{ id: active?.id ?? 0, name: active?.name ?? "Working Hours", timeZone: active?.timeZone ?? user.timeZone }}
        initialWeekly={weekly}
        initialOverrides={overrides}
      />
    </div>
  );
}
