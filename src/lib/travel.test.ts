import { describe, it, expect } from "vitest";
import { resolveTimezoneSegments } from "./travel";

describe("resolveTimezoneSegments", () => {
  it("returns a single home segment with no travel", () => {
    const segs = resolveTimezoneSegments(
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-10T00:00:00Z"),
      "America/New_York",
      [],
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].timeZone).toBe("America/New_York");
  });

  it("inserts a travel segment surrounded by home segments", () => {
    const segs = resolveTimezoneSegments(
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-30T00:00:00Z"),
      "America/New_York",
      [{ timeZone: "Asia/Tokyo", startDate: "2026-06-10", endDate: "2026-06-12" }],
    );
    expect(segs.map((s) => s.timeZone)).toEqual([
      "America/New_York",
      "Asia/Tokyo",
      "America/New_York",
    ]);
    // segments are contiguous and ordered
    for (let i = 1; i < segs.length; i++) expect(segs[i].start).toBe(segs[i - 1].end);
    // the Tokyo block starts at Tokyo midnight on the 10th
    const tokyo = segs[1];
    expect(new Date(tokyo.start).toISOString()).toBe("2026-06-09T15:00:00.000Z");
    expect(new Date(tokyo.end).toISOString()).toBe("2026-06-12T15:00:00.000Z");
  });

  it("clips travel periods to the requested window", () => {
    const segs = resolveTimezoneSegments(
      new Date("2026-06-10T00:00:00Z"),
      new Date("2026-06-15T00:00:00Z"),
      "UTC",
      [{ timeZone: "Asia/Tokyo", startDate: "2026-06-01", endDate: "2026-06-30" }],
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].timeZone).toBe("Asia/Tokyo");
    expect(segs[0].start).toBe(new Date("2026-06-10T00:00:00Z").getTime());
    expect(segs[0].end).toBe(new Date("2026-06-15T00:00:00Z").getTime());
  });

  it("first-wins on overlapping periods", () => {
    const segs = resolveTimezoneSegments(
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-30T00:00:00Z"),
      "UTC",
      [
        { timeZone: "Asia/Tokyo", startDate: "2026-06-05", endDate: "2026-06-15" },
        { timeZone: "Europe/Paris", startDate: "2026-06-10", endDate: "2026-06-20" },
      ],
    );
    // Tokyo claimed first; Paris only gets the non-overlapping tail
    const zones = segs.map((s) => s.timeZone);
    expect(zones).toContain("Asia/Tokyo");
    expect(zones).toContain("Europe/Paris");
    // no segment overlaps another
    for (let i = 1; i < segs.length; i++) expect(segs[i].start).toBe(segs[i - 1].end);
  });
});
