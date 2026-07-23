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

/** Hard cap on the date span a public slots request may ask for. */
const MAX_PUBLIC_RANGE_DAYS = 93;

export type PublicSlotRange =
  | { ok: true; rangeStart: Date; rangeEnd: Date }
  | { ok: false; error: string };

/**
 * Parse and validate the start/end query params of a public slots request.
 * Defaults to a 33-day window from the requested start (or today).
 */
export function parsePublicSlotRange(
  startParam: string | null,
  endParam: string | null,
): PublicSlotRange {
  const rangeStart = startParam ? new Date(`${startParam}T00:00:00Z`) : new Date();
  const rangeEnd = endParam
    ? new Date(`${endParam}T23:59:59Z`)
    : new Date(rangeStart.getTime() + 33 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return { ok: false, error: "Invalid date range" };
  }
  if (rangeEnd < rangeStart) {
    return { ok: false, error: "End date must be after start date" };
  }
  const spanDays = (rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > MAX_PUBLIC_RANGE_DAYS) {
    return { ok: false, error: `Range cannot exceed ${MAX_PUBLIC_RANGE_DAYS} days` };
  }
  return { ok: true, rangeStart, rangeEnd };
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
  beforeBuffer?: number;
  afterBuffer?: number;
  /** minutes of lead time required before "now" */
  minimumNotice?: number;
  /** existing busy intervals (bookings, OOO, external calendars) */
  busy?: Interval[];
  /** reference "now" — injectable for testing */
  now?: Date;
}

export interface Slot {
  /** UTC ISO start time */
  time: string;
  /** remaining seats when seatsPerSlot is set */
  seatsRemaining?: number;
}

/** Merge overlapping/adjacent intervals. */
function mergeIntervals(intervals: Interval[]): Interval[] {
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

/**
 * Compute the free working windows (UTC intervals) for a single calendar day
 * in the schedule's timezone, applying date overrides over weekly rules.
 */
function workingWindowsForDay(
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

/**
 * Generate bookable slots across the requested range.
 */
export function computeSlots(input: SlotEngineInput): Slot[] {
  const now = input.now ?? new Date();
  const duration = input.duration;
  const step = input.slotInterval && input.slotInterval > 0 ? input.slotInterval : duration;
  const before = (input.beforeBuffer ?? 0) * 60000;
  const after = (input.afterBuffer ?? 0) * 60000;
  const notice = (input.minimumNotice ?? 0) * 60000;
  const earliest = now.getTime() + notice;

  const upperBound = input.rangeEnd.getTime();
  const lowerBound = Math.max(input.rangeStart.getTime(), earliest);
  if (lowerBound >= upperBound) return [];

  const busy = mergeIntervals(input.busy ?? []);
  const slots: Slot[] = [];
  const slotMs = duration * 60000;
  const stepMs = step * 60000;

  // Iterate day by day across the schedule timezone to apply working windows.
  let dayKey = formatDateKey(input.rangeStart, input.scheduleTimeZone);
  const lastKey = formatDateKey(new Date(upperBound), input.scheduleTimeZone);

  // Guard against pathological ranges.
  for (let guard = 0; guard < 800; guard++) {
    const windows = workingWindowsForDay(dayKey, input.rules, input.scheduleTimeZone);
    for (const w of windows) {
      for (let t = w.start; t + slotMs <= w.end; t += stepMs) {
        if (t < lowerBound || t >= upperBound) continue;
        const occupied: Interval = { start: t - before, end: t + slotMs + after };
        const isFree = busy.every((b) => occupied.end <= b.start || occupied.start >= b.end);
        if (!isFree) continue;

        const iso = new Date(t).toISOString();
        slots.push({ time: iso });
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
