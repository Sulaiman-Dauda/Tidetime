import type { Slot } from "@/lib/slots";

/** A provider's computed availability for a window. */
export interface HostSlots {
  hostId: number;
  slots: Slot[];
}

export interface TeamSlot {
  time: string;
  /** host ids able to take this slot */
  hostIds: number[];
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

  const byTime = new Map<string, number[]>();
  for (const host of hosts) {
    for (const slot of host.slots) {
      const hostIds = byTime.get(slot.time) ?? [];
      hostIds.push(host.hostId);
      byTime.set(slot.time, hostIds);
    }
  }

  const result: TeamSlot[] = [];
  for (const [time, hostIds] of byTime) {
    result.push({ time, hostIds });
  }
  result.sort((a, b) => a.time.localeCompare(b.time));
  return result;
}
