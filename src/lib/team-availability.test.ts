import { describe, it, expect } from "vitest";
import { mergeTeamSlots, checkTeamCapacity, type HostSlots } from "./team-availability";

const hostA: HostSlots = {
  hostId: 1,
  slots: [{ time: "2025-01-01T09:00:00Z" }, { time: "2025-01-01T10:00:00Z" }],
};
const hostB: HostSlots = {
  hostId: 2,
  slots: [{ time: "2025-01-01T10:00:00Z" }, { time: "2025-01-01T11:00:00Z" }],
};

describe("mergeTeamSlots", () => {
  it("returns empty when there are no hosts", () => {
    expect(mergeTeamSlots("round_robin", [])).toEqual([]);
  });

  it("unions slots for round_robin and sums seats", () => {
    const out = mergeTeamSlots("round_robin", [hostA, hostB]);
    expect(out.map((s) => s.time)).toEqual([
      "2025-01-01T09:00:00Z",
      "2025-01-01T10:00:00Z",
      "2025-01-01T11:00:00Z",
    ]);
    const shared = out.find((s) => s.time === "2025-01-01T10:00:00Z")!;
    expect(shared.hostIds.sort()).toEqual([1, 2]);
    expect(shared.seatsRemaining).toBe(2);
  });

  it("intersects slots for collective scheduling", () => {
    const out = mergeTeamSlots("collective", [hostA, hostB]);
    expect(out.map((s) => s.time)).toEqual(["2025-01-01T10:00:00Z"]);
    expect(out[0].hostIds.sort()).toEqual([1, 2]);
  });

  it("treats managed like round_robin (union)", () => {
    const out = mergeTeamSlots("managed", [hostA, hostB]);
    expect(out).toHaveLength(3);
  });

  it("sorts slots chronologically", () => {
    const out = mergeTeamSlots("round_robin", [
      { hostId: 3, slots: [{ time: "2025-01-01T15:00:00Z" }, { time: "2025-01-01T08:00:00Z" }] },
    ]);
    expect(out.map((s) => s.time)).toEqual([
      "2025-01-01T08:00:00Z",
      "2025-01-01T15:00:00Z",
    ]);
  });
});

describe("checkTeamCapacity", () => {
  it("allows when under all limits", () => {
    expect(
      checkTeamCapacity(
        { maxBookingsPerDay: 5, maxConcurrentBookings: 2 },
        { bookingsOnDay: 3, concurrentBookings: 1 },
      ),
    ).toEqual({ ok: true });
  });

  it("treats null limits as unlimited", () => {
    expect(
      checkTeamCapacity(
        { maxBookingsPerDay: null, maxConcurrentBookings: null },
        { bookingsOnDay: 999, concurrentBookings: 999 },
      ),
    ).toEqual({ ok: true });
  });

  it("rejects when the day is full", () => {
    expect(
      checkTeamCapacity({ maxBookingsPerDay: 4 }, { bookingsOnDay: 4, concurrentBookings: 0 }),
    ).toEqual({ ok: false, reason: "day_full" });
  });

  it("rejects when concurrency is full", () => {
    expect(
      checkTeamCapacity(
        { maxConcurrentBookings: 2 },
        { bookingsOnDay: 0, concurrentBookings: 2 },
      ),
    ).toEqual({ ok: false, reason: "concurrency_full" });
  });
});
