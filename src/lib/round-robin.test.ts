import { describe, it, expect } from "vitest";
import {
  selectRoundRobinHost,
  selectCollectiveHosts,
  type RRHost,
} from "./round-robin";

function host(partial: Partial<RRHost> & { userId: number }): RRHost {
  return {
    weight: 100,
    priority: 2,
    available: true,
    totalAssigned: 0,
    upcomingLoad: 0,
    ...partial,
  };
}

describe("selectRoundRobinHost", () => {
  it("returns null when no host is available", () => {
    const hosts = [host({ userId: 1, available: false }), host({ userId: 2, available: false })];
    expect(selectRoundRobinHost({ mode: "sequential", hosts })).toBeNull();
  });

  it("skips unavailable hosts (availability-aware)", () => {
    const hosts = [
      host({ userId: 1, available: false, totalAssigned: 0 }),
      host({ userId: 2, available: true, totalAssigned: 5 }),
    ];
    const picked = selectRoundRobinHost({ mode: "sequential", hosts });
    expect(picked?.userId).toBe(2);
  });

  it("sequential rotation favours the least-assigned host", () => {
    const hosts = [
      host({ userId: 1, totalAssigned: 3 }),
      host({ userId: 2, totalAssigned: 1 }),
      host({ userId: 3, totalAssigned: 2 }),
    ];
    expect(selectRoundRobinHost({ mode: "sequential", hosts })?.userId).toBe(2);
  });

  it("sequential rotation distributes evenly over many bookings", () => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 30; i++) {
      const hosts = [1, 2, 3].map((id) => host({ userId: id, totalAssigned: counts[id] }));
      const picked = selectRoundRobinHost({ mode: "sequential", hosts })!;
      counts[picked.userId]++;
    }
    expect(counts).toEqual({ 1: 10, 2: 10, 3: 10 });
  });

  it("weights bias the distribution proportionally", () => {
    const counts: Record<number, number> = { 1: 0, 2: 0 };
    for (let i = 0; i < 30; i++) {
      const hosts = [
        host({ userId: 1, weight: 100, totalAssigned: counts[1] }),
        host({ userId: 2, weight: 200, totalAssigned: counts[2] }),
      ];
      const picked = selectRoundRobinHost({ mode: "sequential", hosts })!;
      counts[picked.userId]++;
    }
    // Host 2 has double weight, so should absorb roughly twice the load.
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[1] + counts[2]).toBe(30);
  });

  it("least_busy picks the host with the fewest upcoming bookings", () => {
    const hosts = [
      host({ userId: 1, upcomingLoad: 4, totalAssigned: 100 }),
      host({ userId: 2, upcomingLoad: 1, totalAssigned: 50 }),
    ];
    expect(selectRoundRobinHost({ mode: "least_busy", hosts })?.userId).toBe(2);
  });

  it("only considers the highest available priority tier", () => {
    const hosts = [
      host({ userId: 1, priority: 5, totalAssigned: 10 }),
      host({ userId: 2, priority: 1, totalAssigned: 0 }),
    ];
    // Host 2 is less busy but lower priority, so host 1 wins.
    expect(selectRoundRobinHost({ mode: "sequential", hosts })?.userId).toBe(1);
  });

  it("random mode honours weights with an injected RNG", () => {
    const hosts = [
      host({ userId: 1, weight: 100 }),
      host({ userId: 2, weight: 300 }),
    ];
    // total weight 400; r = 0.1*400 = 40 < 100 → host 1
    expect(selectRoundRobinHost({ mode: "random", hosts, random: () => 0.1 })?.userId).toBe(1);
    // r = 0.5*400 = 200 → after subtracting 100 → host 2
    expect(selectRoundRobinHost({ mode: "random", hosts, random: () => 0.5 })?.userId).toBe(2);
  });

  it("ties break deterministically on userId", () => {
    const hosts = [host({ userId: 3 }), host({ userId: 1 }), host({ userId: 2 })];
    expect(selectRoundRobinHost({ mode: "sequential", hosts })?.userId).toBe(1);
  });
});

describe("selectCollectiveHosts", () => {
  it("returns all host ids when everyone is free", () => {
    const result = selectCollectiveHosts([
      { userId: 1, available: true },
      { userId: 2, available: true },
    ]);
    expect(result).toEqual([1, 2]);
  });

  it("returns null if any host is busy", () => {
    const result = selectCollectiveHosts([
      { userId: 1, available: true },
      { userId: 2, available: false },
    ]);
    expect(result).toBeNull();
  });

  it("returns null for an empty host list", () => {
    expect(selectCollectiveHosts([])).toBeNull();
  });
});
