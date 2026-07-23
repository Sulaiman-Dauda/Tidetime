import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/guard";
import { db } from "@/db";
import { schedules, availabilities, users } from "@/db/schema";
import { AvailabilityEditor, type WeeklyRule, type DateOverride } from "./editor";
import { CreateScheduleButton } from "./create-schedule-button";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const { user } = await requirePermission("availability.own.manage");

  // Use the default schedule, or the first one.
  const all = await db.select().from(schedules).where(eq(schedules.userId, user.id));
  const active = all.find((s) => s.id === user.defaultScheduleId) ?? all[0];

  if (!active) {
    // No schedule at all (legacy data) — the provider is offering zero public
    // slots. Surface that instead of rendering a broken editor.
    return (
      <div className="animate-fade-in space-y-8">
        <PageHeader title="Availability" description="Set the hours people can book you." />
        <EmptyState
          brand
          title="No schedule yet"
          description="Without a schedule you can't be booked. Create one to set your working hours — it starts with weekdays 9:00–17:00."
        />
        <div className="flex justify-center">
          <CreateScheduleButton />
        </div>
      </div>
    );
  }

  // Heal a dangling default pointer (e.g. after legacy deletes) so public
  // availability resolution matches what this page shows.
  if (user.defaultScheduleId !== active.id) {
    await db.update(users).set({ defaultScheduleId: active.id }).where(eq(users.id, user.id));
  }

  const rows = await db.select().from(availabilities).where(eq(availabilities.scheduleId, active.id));

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
        schedule={{ id: active.id, name: active.name, timeZone: active.timeZone ?? user.timeZone }}
        initialWeekly={weekly}
        initialOverrides={overrides}
      />
    </div>
  );
}
