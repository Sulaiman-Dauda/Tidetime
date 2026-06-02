import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listBlockedPeriods } from "@/server/blocked-periods";
import { BlockedPeriodsManager } from "./blocked-periods-manager";

export const metadata = { title: "Blocked Periods · Tidetime" };

export default async function BlockedPeriodsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  const periods = await listBlockedPeriods();

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Blocked Periods</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Company-wide closures (holidays, maintenance windows) that make every provider
          unavailable for the selected range — overriding all schedules.
        </p>
      </div>
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
