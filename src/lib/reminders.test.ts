import { describe, it, expect } from "vitest";
import { planReminders, offsetLabel, type ReminderRule } from "./reminders";

const rule = (id: number, offsetMinutes: number): ReminderRule => ({
  id,
  offsetMinutes,
  action: "email_attendee",
});

describe("planReminders", () => {
  const start = new Date("2026-06-10T15:00:00.000Z");
  const now = new Date("2026-06-09T09:00:00.000Z");

  it("computes absolute send times for each rule", () => {
    const plan = planReminders(start, [rule(1, 24 * 60), rule(2, 60), rule(3, 15)], now);
    expect(plan.map((p) => p.sendAt.toISOString())).toEqual([
      "2026-06-09T15:00:00.000Z", // 24h before
      "2026-06-10T14:00:00.000Z", // 1h before
      "2026-06-10T14:45:00.000Z", // 15m before
    ]);
  });

  it("supports multiple reminders for one booking", () => {
    const plan = planReminders(start, [rule(1, 1440), rule(2, 120), rule(3, 30)], now);
    expect(plan).toHaveLength(3);
  });

  it("drops reminders whose send time is already in the past", () => {
    const lateNow = new Date("2026-06-10T14:30:00.000Z");
    const plan = planReminders(start, [rule(1, 1440), rule(2, 60), rule(3, 15)], lateNow);
    // only the 15-minutes-before reminder (14:45) is still in the future
    expect(plan).toHaveLength(1);
    expect(plan[0].workflowId).toBe(3);
  });

  it("ignores negative offsets", () => {
    expect(planReminders(start, [rule(1, -10)], now)).toHaveLength(0);
  });

  it("sorts reminders earliest-first", () => {
    const plan = planReminders(start, [rule(1, 15), rule(2, 1440), rule(3, 60)], now);
    const times = plan.map((p) => p.sendAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe("offsetLabel", () => {
  it("formats days, hours and minutes", () => {
    expect(offsetLabel(1440)).toBe("1d before");
    expect(offsetLabel(2880)).toBe("2d before");
    expect(offsetLabel(60)).toBe("1h before");
    expect(offsetLabel(15)).toBe("15m before");
  });
});
