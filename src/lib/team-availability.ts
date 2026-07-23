import type { Slot } from "@/lib/slots";

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
 * A slot is offered when at least one eligible provider is available.
 */
export function mergeTeamSlots(
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

  const result: TeamSlot[] = [];
  for (const [time, entry] of byTime) {
    result.push({
      time,
      hostIds: entry.hostIds,
      seatsRemaining: entry.seats,
    });
  }
  result.sort((a, b) => a.time.localeCompare(b.time));
  return result;
}
