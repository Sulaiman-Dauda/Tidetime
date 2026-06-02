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
 * - "round_robin" and "managed": a slot is offered if ANY host is free
 *   (union). seatsRemaining is the sum across free hosts.
 * - "collective": a slot is offered only if EVERY host is free
 *   (intersection), since all hosts attend together.
 */
export function mergeTeamSlots(
  schedulingType: SchedulingType,
  hosts: HostSlots[],
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
  const result: TeamSlot[] = [];
  for (const [time, entry] of byTime) {
    if (requireAll && entry.hostIds.length < hosts.length) continue;
    result.push({
      time,
      hostIds: entry.hostIds,
      seatsRemaining: requireAll ? Math.min(...hosts.map(() => 1)) : entry.seats,
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
