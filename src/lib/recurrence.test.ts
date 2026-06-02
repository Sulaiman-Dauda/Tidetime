import { describe, it, expect } from "vitest";
import {
  expandRecurrence,
  normalizeRecurringRule,
  describeRecurrence,
  MAX_RECURRENCE_COUNT,
} from "./recurrence";

describe("normalizeRecurringRule", () => {
  it("returns null for empty/invalid rules", () => {
    expect(normalizeRecurringRule(null)).toBeNull();
    expect(normalizeRecurringRule(undefined)).toBeNull();
    // @ts-expect-error invalid freq
    expect(normalizeRecurringRule({ freq: "daily", interval: 1, count: 3 })).toBeNull();
  });

  it("clamps interval and count into safe ranges", () => {
    expect(normalizeRecurringRule({ freq: "weekly", interval: 0, count: 0 })).toEqual({
      freq: "weekly",
      interval: 1,
      count: 1,
    });
    expect(normalizeRecurringRule({ freq: "weekly", interval: 99, count: 9999 })).toEqual({
      freq: "weekly",
      interval: 12,
      count: MAX_RECURRENCE_COUNT,
    });
  });
});

describe("expandRecurrence", () => {
  const start = new Date("2025-01-06T09:00:00Z"); // Monday

  it("expands weekly occurrences by whole weeks", () => {
    const dates = expandRecurrence(start, { freq: "weekly", interval: 1, count: 3 });
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2025-01-06T09:00:00.000Z",
      "2025-01-13T09:00:00.000Z",
      "2025-01-20T09:00:00.000Z",
    ]);
  });

  it("honours the weekly interval", () => {
    const dates = expandRecurrence(start, { freq: "weekly", interval: 2, count: 3 });
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2025-01-06T09:00:00.000Z",
      "2025-01-20T09:00:00.000Z",
      "2025-02-03T09:00:00.000Z",
    ]);
  });

  it("expands monthly occurrences", () => {
    const dates = expandRecurrence(start, { freq: "monthly", interval: 1, count: 3 });
    expect(dates.map((d) => d.toISOString())).toEqual([
      "2025-01-06T09:00:00.000Z",
      "2025-02-06T09:00:00.000Z",
      "2025-03-06T09:00:00.000Z",
    ]);
  });

  it("returns a single date when there is no rule", () => {
    expect(expandRecurrence(start, null)).toHaveLength(1);
  });

  it("respects the max cap argument", () => {
    const dates = expandRecurrence(start, { freq: "weekly", interval: 1, count: 10 }, 4);
    expect(dates).toHaveLength(4);
  });
});

describe("describeRecurrence", () => {
  it("describes weekly and monthly rules", () => {
    expect(describeRecurrence({ freq: "weekly", interval: 1, count: 6 })).toBe(
      "Repeats every week, 6 times",
    );
    expect(describeRecurrence({ freq: "weekly", interval: 2, count: 4 })).toBe(
      "Repeats every 2 weeks, 4 times",
    );
    expect(describeRecurrence({ freq: "monthly", interval: 1, count: 1 })).toBe(
      "Repeats every month, 1 time",
    );
  });

  it("returns an empty string for no rule", () => {
    expect(describeRecurrence(null)).toBe("");
  });
});
