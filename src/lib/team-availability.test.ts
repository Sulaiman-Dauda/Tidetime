import { describe, it, expect } from "vitest";
import { mergeTeamSlots, type HostSlots } from "./team-availability";

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
    expect(mergeTeamSlots([])).toEqual([]);
  });

  it("unions provider slots and preserves eligible provider IDs", () => {
    const out = mergeTeamSlots([hostA, hostB]);
    expect(out.map((s) => s.time)).toEqual([
      "2025-01-01T09:00:00Z",
      "2025-01-01T10:00:00Z",
      "2025-01-01T11:00:00Z",
    ]);
    const shared = out.find((s) => s.time === "2025-01-01T10:00:00Z")!;
    expect(shared.hostIds.sort()).toEqual([1, 2]);
  });

  it("sorts slots chronologically", () => {
    const out = mergeTeamSlots([
      { hostId: 3, slots: [{ time: "2025-01-01T15:00:00Z" }, { time: "2025-01-01T08:00:00Z" }] },
    ]);
    expect(out.map((s) => s.time)).toEqual([
      "2025-01-01T08:00:00Z",
      "2025-01-01T15:00:00Z",
    ]);
  });
});
