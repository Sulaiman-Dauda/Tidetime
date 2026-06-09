import type { Slot } from "@/lib/slots";
import type { SchedulingType } from "@/db/schema";

/** A host's computed availability for a window: ISO start -> seatsRemaining. */
export interface HostSlots {
  hostId: number;
  slots: Slot[];
}

export interface TeamSlot {
  time: string;
  /** host ids able to take this slot */
  hostIds: number[];
  seatsRemaining?: number;
}

/**
 * Merge per-host slot lists into the team's bookable slots.
 *
 * - "round_robin" and "managed": a slot is offered if at least `requiredHosts`
 *   hosts are free. For ordinary services (`requiredHosts` = 1) that's "ANY host
 *   free" and seatsRemaining is the sum across free hosts. For multi-attendant
 *   services (`requiredHosts` > 1) each booking occupies N staff at once, so the
 *   slot is offered only when ≥ N are free and seatsRemaining is how many such
 *   N-staff bookings fit, i.e. floor(freeHosts / N).
 * - "collective": a slot is offered only if EVERY host is free
 *   (intersection), since all hosts attend together.
 */
export function mergeTeamSlots(
  schedulingType: SchedulingType,
  hosts: HostSlots[],
  requiredHosts = 1,
): TeamSlot[] {
  if (hosts.length === 0) return [];

  const byTime = new Map<string, { hostIds: number[]; seats: number }>();
  for (const host of hosts) {
    for (const slot of host.slots) {
      const entry = byTime.get(slot.time) ?? { hostIds: [], seats: 0 };
      entry.hostIds.push(host.hostId);
      entry.seats += slot.seatsRemaining ?? 1;
      byTime.set(slot.time, entry);
    }
  }

  const requireAll = schedulingType === "collective";
  // How many free hosts a single booking consumes. Collective takes the whole
  // team; otherwise it's the multi-attendant count, clamped to the roster size.
  const needed = requireAll ? hosts.length : Math.min(Math.max(1, requiredHosts), hosts.length);

  const result: TeamSlot[] = [];
  for (const [time, entry] of byTime) {
    if (entry.hostIds.length < needed) continue;
    result.push({
      time,
      hostIds: entry.hostIds,
      seatsRemaining: needed > 1 ? Math.floor(entry.hostIds.length / needed) : entry.seats,
    });
  }
  result.sort((a, b) => a.time.localeCompare(b.time));
  return result;
}

export interface CapacityRule {
  maxBookingsPerDay?: number | null;
  maxConcurrentBookings?: number | null;
}

export interface CapacityUsage {
  /** bookings already on the target day */
  bookingsOnDay: number;
  /** bookings overlapping the requested interval */
  concurrentBookings: number;
}

export type CapacityResult =
  | { ok: true }
  | { ok: false; reason: "day_full" | "concurrency_full" };

/**
 * Check whether a new team booking is allowed under the team's capacity rules.
 * A null/undefined limit means unlimited.
 */
export function checkTeamCapacity(rule: CapacityRule, usage: CapacityUsage): CapacityResult {
  if (
    rule.maxBookingsPerDay != null &&
    usage.bookingsOnDay >= rule.maxBookingsPerDay
  ) {
    return { ok: false, reason: "day_full" };
  }
  if (
    rule.maxConcurrentBookings != null &&
    usage.concurrentBookings >= rule.maxConcurrentBookings
  ) {
    return { ok: false, reason: "concurrency_full" };
  }
  return { ok: true };
}

export const CAPACITY_MESSAGES: Record<"day_full" | "concurrency_full", string> = {
  day_full: "This team has reached its maximum bookings for the day.",
  concurrency_full: "This team has reached its maximum concurrent bookings for this time.",
};
