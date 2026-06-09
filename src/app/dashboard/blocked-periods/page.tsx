import { requirePermission } from "@/lib/guard";
import { listBlockedPeriods } from "@/server/blocked-periods";
import { BlockedPeriodsManager } from "./blocked-periods-manager";
import { PageHeader } from "@/app/dashboard/_components/page-header";

export const metadata = { title: "Blocked Periods" };

export default async function BlockedPeriodsPage() {
  await requirePermission("team.manage");

  const periods = await listBlockedPeriods();

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Blocked Periods"
        description="Company-wide closures (holidays, maintenance windows) that make every provider unavailable for the selected range — overriding all schedules."
      />
      <BlockedPeriodsManager
        periods={periods.map((p) => ({
          id: p.id,
          start: p.start.toISOString(),
          end: p.end.toISOString(),
          reason: p.reason,
        }))}
      />
    </div>
  );
}
