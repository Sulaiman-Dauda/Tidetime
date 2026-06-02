/**
 * Pure analytics aggregation. Takes raw booking rows and derives the summary
 * metrics shown on the analytics dashboard, free of any DB dependency.
 */

export interface AnalyticsBookingRow {
  status: "pending" | "accepted" | "cancelled" | "rejected";
  startTime: Date;
  /** whether any attendee was marked a no-show */
  noShow: boolean;
  /** captured revenue in the smallest currency unit (only paid bookings) */
  revenue: number;
  /** assigned host user id (for utilization) */
  userId: number | null;
}

export interface AnalyticsSummary {
  total: number;
  completed: number;
  cancelled: number;
  noShows: number;
  upcoming: number;
  revenue: number;
  /** bookings per host user id */
  utilization: Record<number, number>;
}

/**
 * "Completed" = an accepted booking whose end is in the past and which was not
 * a no-show. We approximate end using start for simplicity at this layer.
 */
export function summarize(rows: AnalyticsBookingRow[], now: Date = new Date()): AnalyticsSummary {
  const summary: AnalyticsSummary = {
    total: 0,
    completed: 0,
    cancelled: 0,
    noShows: 0,
    upcoming: 0,
    revenue: 0,
    utilization: {},
  };

  for (const r of rows) {
    summary.total++;
    summary.revenue += Math.max(0, r.revenue);

    if (r.status === "cancelled" || r.status === "rejected") {
      summary.cancelled++;
      continue;
    }
    if (r.noShow) {
      summary.noShows++;
      continue;
    }
    const isPast = r.startTime.getTime() < now.getTime();
    if (r.status === "accepted" && isPast) {
      summary.completed++;
    } else if (!isPast) {
      summary.upcoming++;
    }

    if (r.userId != null) {
      summary.utilization[r.userId] = (summary.utilization[r.userId] ?? 0) + 1;
    }
  }

  return summary;
}

/** Completion rate as a 0..1 fraction (completed / non-cancelled total). */
export function completionRate(summary: AnalyticsSummary): number {
  const denominator = summary.total - summary.cancelled;
  if (denominator <= 0) return 0;
  return summary.completed / denominator;
}
