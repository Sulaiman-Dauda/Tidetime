/**
 * Pure resource-conflict math — no DB imports, fully unit testable.
 *
 * A resource (room, vehicle, desk…) supports `capacity` concurrent bookings.
 * - `busyIntervalsAtCapacity` collapses existing reservations into the windows
 *   where the resource is fully utilised, so the slot engine can treat them as
 *   busy time.
 * - `hasResourceCapacity` is the race-safe check used at booking time.
 */

export interface Interval {
  start: number;
  end: number;
}

/** Do two half-open intervals [start,end) overlap? */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Given existing reservations, return the merged windows where the number of
 * concurrent reservations is >= capacity (i.e. a new booking would exceed it).
 * A sweep line over interval edges keeps this O(n log n).
 */
export function busyIntervalsAtCapacity(existing: Interval[], capacity: number): Interval[] {
  if (capacity < 1) capacity = 1;
  const edges: { t: number; delta: number }[] = [];
  for (const iv of existing) {
    if (iv.end <= iv.start) continue;
    edges.push({ t: iv.start, delta: 1 });
    edges.push({ t: iv.end, delta: -1 });
  }
  edges.sort((a, b) => a.t - b.t || a.delta - b.delta);

  const out: Interval[] = [];
  let count = 0;
  let windowStart: number | null = null;
  for (const e of edges) {
    const wasFull = count >= capacity;
    count += e.delta;
    const isFull = count >= capacity;
    if (!wasFull && isFull) {
      windowStart = e.t;
    } else if (wasFull && !isFull && windowStart !== null) {
      out.push({ start: windowStart, end: e.t });
      windowStart = null;
    }
  }
  return mergeIntervals(out);
}

/** Merge overlapping/adjacent intervals. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      out.push({ ...sorted[i] });
    }
  }
  return out;
}

/**
 * Can `candidate` be added without exceeding `capacity` at any instant?
 * Computes the peak concurrency of existing reservations within the candidate
 * window and checks there is room for one more.
 */
export function hasResourceCapacity(
  existing: Interval[],
  candidate: Interval,
  capacity: number,
): boolean {
  if (capacity < 1) capacity = 1;
  const relevant = existing.filter((iv) => overlaps(iv, candidate));
  if (relevant.length === 0) return capacity >= 1;

  const edges: { t: number; delta: number }[] = [];
  for (const iv of relevant) {
    edges.push({ t: Math.max(iv.start, candidate.start), delta: 1 });
    edges.push({ t: Math.min(iv.end, candidate.end), delta: -1 });
  }
  edges.sort((a, b) => a.t - b.t || a.delta - b.delta);

  let count = 0;
  let peak = 0;
  for (const e of edges) {
    count += e.delta;
    if (count > peak) peak = count;
  }
  return peak + 1 <= capacity;
}
