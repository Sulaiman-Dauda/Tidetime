import { zonedTimeToUtc } from "./time";

/**
 * Travel schedules (stolen from cal.diy). A travel period is a date-bounded
 * timezone override: "while I'm in this place from D1..D2, treat my hours as that
 * timezone". To stay availability-correct we split the requested booking window
 * into contiguous segments, each tagged with the timezone in force, and compute
 * slots per segment. Pure + dependency-free so it's unit-testable.
 */

export interface TravelPeriod {
  /** IANA timezone in force during the period */
  timeZone: string;
  /** inclusive "YYYY-MM-DD" */
  startDate: string;
  /** inclusive "YYYY-MM-DD" */
  endDate: string;
}

export interface TzSegment {
  /** epoch ms (inclusive start) */
  start: number;
  /** epoch ms (exclusive end) */
  end: number;
  timeZone: string;
}

function dayStartUtc(dateKey: string, tz: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return zonedTimeToUtc(y, m, d, 0, 0, tz).getTime();
}

/** Midnight of the day AFTER endDate, i.e. the exclusive end of an inclusive range. */
function dayAfterUtc(dateKey: string, tz: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return zonedTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, tz).getTime();
}

/**
 * Partition [rangeStart, rangeEnd) into timezone segments. Gaps not covered by a
 * travel period use `homeTz`. Travel periods are first-wins on overlap (the UI
 * should keep them disjoint anyway). When there are no travel periods, returns a
 * single home-timezone segment, so the common path is unchanged.
 */
export function resolveTimezoneSegments(
  rangeStart: Date,
  rangeEnd: Date,
  homeTz: string,
  travels: TravelPeriod[],
): TzSegment[] {
  const rs = rangeStart.getTime();
  const re = rangeEnd.getTime();
  if (re <= rs) return [];

  const intervals = travels
    .map((t) => ({
      start: Math.max(rs, dayStartUtc(t.startDate, t.timeZone)),
      end: Math.min(re, dayAfterUtc(t.endDate, t.timeZone)),
      timeZone: t.timeZone,
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  // First-wins overlap resolution.
  const claimed: TzSegment[] = [];
  let lastEnd = rs;
  for (const iv of intervals) {
    const start = Math.max(iv.start, lastEnd);
    if (start < iv.end) {
      claimed.push({ start, end: iv.end, timeZone: iv.timeZone });
      lastEnd = iv.end;
    }
  }

  const segments: TzSegment[] = [];
  let cursor = rs;
  for (const c of claimed) {
    if (c.start > cursor) segments.push({ start: cursor, end: c.start, timeZone: homeTz });
    segments.push(c);
    cursor = c.end;
  }
  if (cursor < re) segments.push({ start: cursor, end: re, timeZone: homeTz });
  return segments;
}
