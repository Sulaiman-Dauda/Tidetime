/**
 * Round-robin host assignment for team event types.
 *
 * Pure functions over plain data so the selection policy is fully testable
 * without a database. The DB-backed wrapper lives in `src/server/round-robin.ts`.
 */

export type RoundRobinMode = "sequential" | "least_busy" | "random";

export interface RRHost {
  userId: number;
  /** relative weight; a host with weight 200 receives ~2x the load of weight 100 */
  weight: number;
  /** higher priority hosts are preferred; only the top tier is considered */
  priority: number;
  /** whether the host is free for the target slot */
  available: boolean;
  /** lifetime assigned bookings — drives fair sequential rotation */
  totalAssigned: number;
  /** current upcoming load — drives least-busy distribution */
  upcomingLoad: number;
}

export interface SelectHostInput {
  mode: RoundRobinMode;
  hosts: RRHost[];
  /** injectable RNG in [0,1) for deterministic tests */
  random?: () => number;
}

/**
 * Pick exactly one host for a round-robin booking, or `null` if none are
 * available. Only hosts in the highest available priority tier are eligible.
 */
export function selectRoundRobinHost(input: SelectHostInput): RRHost | null {
  const available = input.hosts.filter((h) => h.available && h.weight > 0);
  if (available.length === 0) return null;

  // Restrict to the highest-priority tier among available hosts.
  const topPriority = Math.max(...available.map((h) => h.priority));
  const pool = available.filter((h) => h.priority === topPriority);

  if (input.mode === "random") {
    return weightedRandom(pool, input.random ?? Math.random);
  }

  const metric = (h: RRHost) =>
    input.mode === "least_busy" ? h.upcomingLoad : h.totalAssigned;

  // Normalise the load by weight so heavier hosts absorb proportionally more.
  // Lowest ratio wins; ties broken deterministically by userId.
  let best = pool[0];
  let bestRatio = metric(best) / best.weight;
  for (let i = 1; i < pool.length; i++) {
    const h = pool[i];
    const ratio = metric(h) / h.weight;
    if (ratio < bestRatio || (ratio === bestRatio && h.userId < best.userId)) {
      best = h;
      bestRatio = ratio;
    }
  }
  return best;
}

/** Weighted random selection from a non-empty pool. */
function weightedRandom(pool: RRHost[], random: () => number): RRHost {
  const total = pool.reduce((sum, h) => sum + h.weight, 0);
  let r = random() * total;
  for (const h of pool) {
    r -= h.weight;
    if (r < 0) return h;
  }
  return pool[pool.length - 1];
}

/**
 * For collective events every fixed host must be available. Returns the list
 * of host ids if all are free, otherwise `null`.
 */
export function selectCollectiveHosts(
  hosts: { userId: number; available: boolean }[],
): number[] | null {
  if (hosts.length === 0) return null;
  if (hosts.some((h) => !h.available)) return null;
  return hosts.map((h) => h.userId);
}
