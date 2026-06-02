import { describe, it, expect } from "vitest";
import { computeSlots, type AvailabilityRule } from "./slots";

/** A daily 09:00–12:00 working window in UTC. */
const rules: AvailabilityRule[] = [
  { days: [0, 1, 2, 3, 4, 5, 6], date: null, startTime: "09:00:00", endTime: "12:00:00" },
];

const base = {
  rangeStart: new Date("2025-01-06T00:00:00Z"),
  rangeEnd: new Date("2025-01-07T00:00:00Z"),
  scheduleTimeZone: "UTC",
  rules,
  duration: 60,
  slotInterval: 60,
  now: new Date("2025-01-01T00:00:00Z"),
};

function times(slots: { time: string }[]): string[] {
  return slots.map((s) => s.time);
}

describe("computeSlots offsetStart", () => {
  it("aligns slots to the window start when offset is 0", () => {
    const slots = computeSlots({ ...base });
    expect(times(slots)).toEqual([
      "2025-01-06T09:00:00.000Z",
      "2025-01-06T10:00:00.000Z",
      "2025-01-06T11:00:00.000Z",
    ]);
  });

  it("shifts slot start times by the offset", () => {
    const slots = computeSlots({ ...base, offsetStart: 15 });
    expect(times(slots)).toEqual([
      "2025-01-06T09:15:00.000Z",
      "2025-01-06T10:15:00.000Z",
    ]);
  });

  it("treats a null/zero offset the same as no offset", () => {
    const a = times(computeSlots({ ...base, offsetStart: 0 }));
    const b = times(computeSlots({ ...base, offsetStart: null }));
    expect(a).toEqual(b);
  });
});
