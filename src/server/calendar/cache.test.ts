import { describe, expect, it } from "vitest";
import { busyWithinRange } from "./cache";
import type { BusyInterval } from "./cache";

const iv = (start: string, end: string): BusyInterval => ({ start, end });

describe("busyWithinRange", () => {
  const range = [new Date("2026-06-10T00:00:00Z"), new Date("2026-06-11T00:00:00Z")] as const;

  it("keeps intervals overlapping the window", () => {
    const busy = [iv("2026-06-10T09:00:00Z", "2026-06-10T10:00:00Z")];
    expect(busyWithinRange(busy, range[0], range[1])).toEqual(busy);
  });

  it("drops intervals entirely before the window", () => {
    const busy = [iv("2026-06-09T09:00:00Z", "2026-06-09T10:00:00Z")];
    expect(busyWithinRange(busy, range[0], range[1])).toEqual([]);
  });

  it("drops intervals entirely after the window", () => {
    const busy = [iv("2026-06-12T09:00:00Z", "2026-06-12T10:00:00Z")];
    expect(busyWithinRange(busy, range[0], range[1])).toEqual([]);
  });

  it("keeps intervals straddling the window boundary", () => {
    const busy = [iv("2026-06-09T23:00:00Z", "2026-06-10T01:00:00Z")];
    expect(busyWithinRange(busy, range[0], range[1])).toEqual(busy);
  });

  it("treats touching-at-the-edge as non-overlapping", () => {
    // ends exactly at rangeStart → no overlap
    const busy = [iv("2026-06-09T22:00:00Z", "2026-06-10T00:00:00Z")];
    expect(busyWithinRange(busy, range[0], range[1])).toEqual([]);
  });

  it("ignores malformed intervals", () => {
    const busy = [iv("not-a-date", "also-bad"), iv("2026-06-10T09:00:00Z", "2026-06-10T10:00:00Z")];
    expect(busyWithinRange(busy, range[0], range[1])).toHaveLength(1);
  });
});
