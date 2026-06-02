import { describe, it, expect } from "vitest";
import {
  overlaps,
  mergeIntervals,
  busyIntervalsAtCapacity,
  hasResourceCapacity,
  type Interval,
} from "./resources";

const iv = (start: number, end: number): Interval => ({ start, end });

describe("overlaps", () => {
  it("detects overlapping half-open intervals", () => {
    expect(overlaps(iv(0, 10), iv(5, 15))).toBe(true);
  });
  it("treats touching intervals as non-overlapping", () => {
    expect(overlaps(iv(0, 10), iv(10, 20))).toBe(false);
  });
});

describe("mergeIntervals", () => {
  it("merges overlapping and adjacent intervals", () => {
    expect(mergeIntervals([iv(0, 10), iv(10, 20), iv(5, 8)])).toEqual([iv(0, 20)]);
  });
  it("keeps disjoint intervals separate", () => {
    expect(mergeIntervals([iv(0, 5), iv(10, 15)])).toEqual([iv(0, 5), iv(10, 15)]);
  });
  it("returns empty for empty input", () => {
    expect(mergeIntervals([])).toEqual([]);
  });
});

describe("busyIntervalsAtCapacity", () => {
  it("capacity 1: any reservation is busy", () => {
    expect(busyIntervalsAtCapacity([iv(0, 10), iv(20, 30)], 1)).toEqual([
      iv(0, 10),
      iv(20, 30),
    ]);
  });

  it("capacity 2: busy only where two overlap", () => {
    // 0-10 and 5-15 overlap on 5-10 -> only that window is full at capacity 2
    expect(busyIntervalsAtCapacity([iv(0, 10), iv(5, 15)], 2)).toEqual([iv(5, 10)]);
  });

  it("capacity 2: no overlap means never full", () => {
    expect(busyIntervalsAtCapacity([iv(0, 10), iv(20, 30)], 2)).toEqual([]);
  });

  it("ignores zero-length intervals", () => {
    expect(busyIntervalsAtCapacity([iv(5, 5), iv(0, 10)], 1)).toEqual([iv(0, 10)]);
  });
});

describe("hasResourceCapacity", () => {
  it("allows when below capacity", () => {
    expect(hasResourceCapacity([iv(0, 10)], iv(5, 15), 2)).toBe(true);
  });

  it("rejects when adding would exceed capacity", () => {
    expect(hasResourceCapacity([iv(0, 10), iv(0, 10)], iv(0, 10), 2)).toBe(false);
  });

  it("allows when there is no overlap", () => {
    expect(hasResourceCapacity([iv(0, 10)], iv(20, 30), 1)).toBe(true);
  });

  it("rejects a second booking at capacity 1", () => {
    expect(hasResourceCapacity([iv(0, 10)], iv(5, 15), 1)).toBe(false);
  });
});
