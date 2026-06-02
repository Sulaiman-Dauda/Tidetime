import { describe, it, expect } from "vitest";
import { summarize, completionRate, type AnalyticsBookingRow } from "./analytics";

const now = new Date("2026-06-01T12:00:00.000Z");
const past = new Date("2026-05-01T12:00:00.000Z");
const future = new Date("2026-07-01T12:00:00.000Z");

function row(p: Partial<AnalyticsBookingRow>): AnalyticsBookingRow {
  return { status: "accepted", startTime: past, noShow: false, revenue: 0, userId: 1, ...p };
}

describe("summarize", () => {
  it("counts totals across statuses", () => {
    const s = summarize(
      [
        row({ status: "accepted", startTime: past }),
        row({ status: "accepted", startTime: future }),
        row({ status: "cancelled" }),
        row({ status: "rejected" }),
      ],
      now,
    );
    expect(s.total).toBe(4);
    expect(s.completed).toBe(1);
    expect(s.upcoming).toBe(1);
    expect(s.cancelled).toBe(2);
  });

  it("counts no-shows separately from completed", () => {
    const s = summarize([row({ startTime: past, noShow: true })], now);
    expect(s.noShows).toBe(1);
    expect(s.completed).toBe(0);
  });

  it("sums revenue and ignores negatives", () => {
    const s = summarize(
      [row({ revenue: 5000 }), row({ revenue: 2500 }), row({ revenue: -100 })],
      now,
    );
    expect(s.revenue).toBe(7500);
  });

  it("tracks per-host utilization", () => {
    const s = summarize(
      [row({ userId: 1, startTime: past }), row({ userId: 1, startTime: future }), row({ userId: 2, startTime: past })],
      now,
    );
    expect(s.utilization).toEqual({ 1: 2, 2: 1 });
  });
});

describe("completionRate", () => {
  it("computes completed over non-cancelled total", () => {
    const s = summarize(
      [
        row({ status: "accepted", startTime: past }),
        row({ status: "accepted", startTime: past }),
        row({ status: "accepted", startTime: future }),
        row({ status: "cancelled" }),
      ],
      now,
    );
    // total 4, cancelled 1 → denom 3, completed 2
    expect(completionRate(s)).toBeCloseTo(2 / 3);
  });

  it("returns 0 when there is nothing to complete", () => {
    expect(completionRate(summarize([], now))).toBe(0);
  });
});
