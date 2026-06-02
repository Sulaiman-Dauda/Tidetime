/**
 * Availability & slot-computation engine.
 *
 * Pure functions over plain data so the logic is fully testable and free of
 * database/timezone side effects beyond the well-isolated `time` helpers.
 */
import {
  zonedTimeToUtc,
  formatDateKey,
  parseTimeToMinutes,
  addDaysToKey,
  weekdayOfKey,
} from "./time";

/** A half-open time interval [start, end) of UTC instants (ms). */
export interface Interval {
  start: number;
  end: number;
}

export interface AvailabilityRule {
  /** weekday integers 0-6 for recurring rules; empty for date overrides */
  days: number[];
  /** "YYYY-MM-DD" for a date-specific override, else null */
  date: string | null;
  /** "HH:MM:SS" or null (null on an override row = day off) */
  startTime: string | null;
  endTime: string | null;
}

export interface SlotEngineInput {
  /** range to search, as UTC instants */
  rangeStart: Date;
  rangeEnd: Date;
  /** timezone the schedule's wall-clock times are expressed in */
  scheduleTimeZone: string;
  rules: AvailabilityRule[];
  /** event duration in minutes */
  duration: number;
  /** slot granularity in minutes; defaults to duration */
  slotInterval?: number | null;
  /** minutes to offset slot start times within each working window (e.g. 15 → :15/:45) */
  offsetStart?: number | null;
  beforeBuffer?: number;
  afterBuffer?: number;
  /** minutes of lead time required before "now" */
  minimumNotice?: number;
  /** existing busy intervals (bookings, OOO, external calendars) */
  busy?: Interval[];
  /** capacity per slot (>1 for group events) and existing counts keyed by ISO start */
  seatsPerSlot?: number | null;
  seatCounts?: Record<string, number>;
  /** future-window restriction */
  periodType?: "unlimited" | "rolling" | "rolling_window" | "range";
  periodDays?: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  /** frequency caps, e.g. {day:3, week:10}; counts already booked per period */
  bookingLimits?: Record<string, number> | null;
  bookedCounts?: { day?: number; week?: number; month?: number; year?: number };
  /** reference "now" — injectable for testing */
  now?: Date;
}

export interface Slot {
  /** UTC ISO start time */
  time: string;
  /** remaining seats when seatsPerSlot is set */
  seatsRemaining?: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Merge overlapping/adjacent intervals. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ ...cur });
  }
  return out;
}

/** Subtract busy intervals from a free interval, returning remaining free parts. */
export function subtractIntervals(free: Interval, busy: Interval[]): Interval[] {
  let parts: Interval[] = [free];
  for (const b of busy) {
    const next: Interval[] = [];
    for (const p of parts) {
      if (b.end <= p.start || b.start >= p.end) {
        next.push(p); // no overlap
      } else {
        if (b.start > p.start) next.push({ start: p.start, end: b.start });
        if (b.end < p.end) next.push({ start: b.end, end: p.end });
      }
    }
    parts = next;
  }
  return parts;
}

/**
 * Compute the free working windows (UTC intervals) for a single calendar day
 * in the schedule's timezone, applying date overrides over weekly rules.
 */
export function workingWindowsForDay(
  dateKey: string,
  rules: AvailabilityRule[],
  timeZone: string,
): Interval[] {
  // Date overrides take precedence and fully replace weekly rules for that day.
  const overrides = rules.filter((r) => r.date === dateKey);
  let applicable: AvailabilityRule[];
  if (overrides.length > 0) {
    // A single override row with null times means the day is off.
    applicable = overrides.filter((r) => r.startTime && r.endTime);
    if (applicable.length === 0) return [];
  } else {
    const weekday = weekdayOfKey(dateKey);
    applicable = rules.filter(
      (r) => !r.date && r.days.includes(weekday) && r.startTime && r.endTime,
    );
  }

  const [y, m, d] = dateKey.split("-").map(Number);
  const windows: Interval[] = [];
  for (const r of applicable) {
    const startMin = parseTimeToMinutes(r.startTime!);
    const endMin = parseTimeToMinutes(r.endTime!);
    if (endMin <= startMin) continue;
    const start = zonedTimeToUtc(y, m, d, Math.floor(startMin / 60), startMin % 60, timeZone);
    const end = zonedTimeToUtc(y, m, d, Math.floor(endMin / 60), endMin % 60, timeZone);
    windows.push({ start: start.getTime(), end: end.getTime() });
  }
  return mergeIntervals(windows);
}

/** Determine the hard upper bound for bookable dates from the period config. */
function periodBound(input: SlotEngineInput, now: Date): number {
  switch (input.periodType) {
    case "rolling":
    case "rolling_window":
      return input.periodDays != null
        ? now.getTime() + input.periodDays * DAY
        : Number.POSITIVE_INFINITY;
    case "range":
      if (input.periodEndDate) {
        const [y, m, d] = input.periodEndDate.split("-").map(Number);
        return zonedTimeToUtc(y, m, d, 23, 59, input.scheduleTimeZone).getTime();
      }
      return Number.POSITIVE_INFINITY;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function periodLowerBound(input: SlotEngineInput): number {
  if (input.periodType === "range" && input.periodStartDate) {
    const [y, m, d] = input.periodStartDate.split("-").map(Number);
    return zonedTimeToUtc(y, m, d, 0, 0, input.scheduleTimeZone).getTime();
  }
  return Number.NEGATIVE_INFINITY;
}

/** Whether frequency caps already prevent any further bookings. */
function frequencyExhausted(input: SlotEngineInput): boolean {
  const limits = input.bookingLimits;
  if (!limits) return false;
  const counts = input.bookedCounts ?? {};
  return (
    (limits.day != null && (counts.day ?? 0) >= limits.day) ||
    (limits.week != null && (counts.week ?? 0) >= limits.week) ||
    (limits.month != null && (counts.month ?? 0) >= limits.month) ||
    (limits.year != null && (counts.year ?? 0) >= limits.year)
  );
}

/**
 * Generate bookable slots across the requested range.
 */
export function computeSlots(input: SlotEngineInput): Slot[] {
  const now = input.now ?? new Date();
  const duration = input.duration;
  const step = input.slotInterval && input.slotInterval > 0 ? input.slotInterval : duration;
  const offset = input.offsetStart && input.offsetStart > 0 ? input.offsetStart : 0;
  const before = (input.beforeBuffer ?? 0) * 60000;
  const after = (input.afterBuffer ?? 0) * 60000;
  const notice = (input.minimumNotice ?? 0) * 60000;
  const earliest = now.getTime() + notice;

  if (frequencyExhausted(input)) return [];

  const upperBound = Math.min(input.rangeEnd.getTime(), periodBound(input, now));
  const lowerBound = Math.max(input.rangeStart.getTime(), periodLowerBound(input), earliest);
  if (lowerBound >= upperBound) return [];

  const busy = mergeIntervals(input.busy ?? []);
  const seatsPerSlot = input.seatsPerSlot ?? 1;
  const seatCounts = input.seatCounts ?? {};

  const slots: Slot[] = [];
  const slotMs = duration * 60000;
  const stepMs = step * 60000;
  const offsetMs = offset * 60000;

  // Iterate day by day across the schedule timezone to apply working windows.
  let dayKey = formatDateKey(input.rangeStart, input.scheduleTimeZone);
  const lastKey = formatDateKey(new Date(upperBound), input.scheduleTimeZone);

  // Guard against pathological ranges.
  for (let guard = 0; guard < 800; guard++) {
    const windows = workingWindowsForDay(dayKey, input.rules, input.scheduleTimeZone);
    for (const w of windows) {
      // Walk slot starts aligned to the window start, shifted by offsetStart.
      for (let t = w.start + offsetMs; t + slotMs <= w.end; t += stepMs) {
        if (t < lowerBound || t >= upperBound) continue;
        const occupied: Interval = { start: t - before, end: t + slotMs + after };
        // Check against busy times (skip occupancy for seated slots — handled by seatCounts).
        const isFree =
          seatsPerSlot > 1
            ? true
            : busy.every((b) => occupied.end <= b.start || occupied.start >= b.end);
        if (!isFree) continue;

        const iso = new Date(t).toISOString();
        if (seatsPerSlot > 1) {
          const taken = seatCounts[iso] ?? 0;
          const remaining = seatsPerSlot - taken;
          if (remaining <= 0) continue;
          slots.push({ time: iso, seatsRemaining: remaining });
        } else {
          slots.push({ time: iso });
        }
      }
    }
    if (dayKey === lastKey) break;
    dayKey = addDaysToKey(dayKey, 1);
  }

  return slots;
}

/** Group flat slots by date key (in a viewer timezone) for calendar UIs. */
export function groupSlotsByDay(slots: Slot[], viewerTimeZone: string): Record<string, Slot[]> {
  const out: Record<string, Slot[]> = {};
  for (const s of slots) {
    const key = formatDateKey(new Date(s.time), viewerTimeZone);
    (out[key] ??= []).push(s);
  }
  return out;
}
