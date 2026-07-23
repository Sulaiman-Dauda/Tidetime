import { and, asc, eq } from "drizzle-orm";
import { requireAnyPermission } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import { schedules, availabilities, memberships, users } from "@/db/schema";
import { AvailabilityEditor, type WeeklyRule, type DateOverride } from "./editor";
import { CreateScheduleButton } from "./create-schedule-button";
import { PageHeader } from "@/app/dashboard/_components/page-header";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Availability" };

interface Props {
  searchParams: Promise<{ schedule?: string; user?: string }>;
}

export default async function AvailabilityPage({ searchParams }: Props) {
  const { user, role, teamId } = await requireAnyPermission([
    "availability.own.manage",
    "availability.all.manage",
  ]);
  const params = await searchParams;
  const canManageAll = can(role, "availability.all.manage");

  // Owners/admins can manage any accepted member's hours.
  const members = canManageAll
    ? await db
        .select({ id: users.id, name: users.name, username: users.username })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.teamId, teamId), eq(memberships.accepted, true)))
        .orderBy(asc(users.name))
    : [];

  const requestedUserId = Number(params.user) || undefined;
  const targetId =
    canManageAll && requestedUserId && members.some((m) => m.id === requestedUserId)
      ? requestedUserId
      : user.id;
  const [target] = targetId === user.id
    ? [user]
    : await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) return null;
  const editingOther = target.id !== user.id;

  const all = await db
    .select()
    .from(schedules)
    .where(eq(schedules.userId, target.id))
    .orderBy(asc(schedules.id));
  const requestedScheduleId = Number(params.schedule) || undefined;
  const active =
    all.find((s) => s.id === requestedScheduleId) ??
    all.find((s) => s.id === target.defaultScheduleId) ??
    all[0];

  if (!active) {
    // No schedule at all (legacy data) — the provider is offering zero public
    // slots. Surface that instead of rendering a broken editor.
    return (
      <div className="animate-fade-in space-y-8">
        <PageHeader title="Availability" description="Set the hours people can book you." />
        <EmptyState
          brand
          title={editingOther ? `${target.name ?? target.username} has no schedule` : "No schedule yet"}
          description="Without a schedule there are no bookable hours. Create one to set working hours — it starts with weekdays 9:00–17:00."
        />
        <div className="flex justify-center">
          <CreateScheduleButton targetUserId={editingOther ? target.id : undefined} />
        </div>
      </div>
    );
  }

  // Heal a dangling default pointer (e.g. after legacy deletes) so public
  // availability resolution matches what this page shows.
  if (!all.some((s) => s.id === target.defaultScheduleId)) {
    await db.update(users).set({ defaultScheduleId: active.id }).where(eq(users.id, target.id));
    target.defaultScheduleId = active.id;
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
        schedule={{ id: active.id, name: active.name, timeZone: active.timeZone ?? target.timeZone }}
        schedules={all.map((s) => ({ id: s.id, name: s.name, isDefault: s.id === target.defaultScheduleId }))}
        initialWeekly={weekly}
        initialOverrides={overrides}
        weekStart={user.weekStart}
        targetUserId={editingOther ? target.id : undefined}
        targetName={editingOther ? target.name ?? target.username : undefined}
        members={members.map((m) => ({ id: m.id, name: m.name ?? m.username }))}
        viewerId={user.id}
      />
    </div>
  );
}
