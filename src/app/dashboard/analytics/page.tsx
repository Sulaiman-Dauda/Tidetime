import { requireUser } from "@/lib/auth";
import { getUserAnalytics } from "@/server/analytics";
import { completionRate } from "@/lib/analytics";
import {
  CalendarCheck,
  CalendarX2,
  CheckCircle2,
  Clock,
  DollarSign,
  UserX,
} from "lucide-react";

export const metadata = { title: "Analytics" };

const RANGES = { "30": 30, "90": 90, "365": 365 } as const;

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { range } = await searchParams;
  const days = RANGES[(range as keyof typeof RANGES) ?? "90"] ?? 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const a = await getUserAnalytics(user.id, since);
  const rate = Math.round(completionRate(a) * 100);

  const stats = [
    { label: "Total bookings", value: a.total, icon: CalendarCheck, delta: null },
    { label: "Completed", value: a.completed, icon: CheckCircle2, delta: null },
    { label: "Upcoming", value: a.upcoming, icon: Clock, delta: null },
    { label: "Cancelled", value: a.cancelled, icon: CalendarX2, delta: null },
    { label: "No-shows", value: a.noShows, icon: UserX, delta: null },
    { label: "Revenue", value: money(a.revenue), icon: DollarSign, delta: null },
  ];

  const utilization = Object.entries(a.utilization).sort((x, y) => y[1] - x[1]);
  const maxUtil = utilization.length ? Math.max(...utilization.map(([, n]) => n)) : 0;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Completion rate{" "}
            <span className="font-medium text-foreground">{rate}%</span>
          </p>
        </div>
        <div className="flex items-center rounded-md border border-border bg-card p-0.5">
          {(Object.entries(RANGES) as [string, number][]).map(([label, val]) => (
            <a
              key={label}
              href={`/dashboard/analytics?range=${label}`}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                days === val
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}d
            </a>
          ))}
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid gap-px rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-col gap-3 bg-card p-5 first:rounded-tl-lg last:rounded-br-lg sm:first:rounded-tl-lg sm:last:rounded-br-lg [&:nth-child(2)]:sm:rounded-tr-lg [&:nth-child(4)]:lg:rounded-none [&:nth-child(5)]:lg:rounded-none">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <p className="tabular-stat text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Utilization chart */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Provider utilization</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Bookings per host in this period</p>
        {utilization.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No bookings in this period.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {utilization.map(([id, count]) => (
              <li key={id} className="flex items-center gap-4">
                <span className="w-32 shrink-0 truncate text-[13px] font-medium text-foreground">
                  {a.hostNames[Number(id)] ?? `User ${id}`}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${maxUtil ? (count / maxUtil) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
