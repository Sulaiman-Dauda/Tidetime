import { zonedTimeToUtc, isValidTimeZone } from "./time";

/**
 * Minimal, dependency-free iCalendar (RFC 5545) busy-time parser. Extracts only
 * the intervals needed for availability — VEVENTs with DTSTART + DTEND/DURATION,
 * skipping TRANSPARENT (free) events. Recurrence (RRULE) is intentionally not
 * expanded; the CalDAV time-range REPORT already returns expanded instances for
 * the requested window on compliant servers.
 *
 * Pure and exhaustively unit-tested so the CalDAV adapter's correctness doesn't
 * depend on a live server.
 */

export interface IcalBusyInterval {
  start: string;
  end: string;
}

/** Un-fold RFC 5545 line continuations (leading space/tab joins the prior line). */
export function unfoldIcs(ics: string): string[] {
  const out: string[] = [];
  for (const line of ics.split(/\r?\n/)) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Parse a DTSTART/DTEND property line to a UTC Date (date, UTC, or TZID forms). */
export function parseIcsDate(line: string): Date | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const params = line.slice(0, colon);
  const value = line.slice(colon + 1).trim();

  if (/^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4);
    const mo = +value.slice(4, 6);
    const d = +value.slice(6, 8);
    return new Date(Date.UTC(y, mo - 1, d));
  }

  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));

  const tzMatch = params.match(/TZID=([^;:]+)/);
  if (tzMatch && isValidTimeZone(tzMatch[1])) {
    return zonedTimeToUtc(+y, +mo, +d, +h, +mi, tzMatch[1]);
  }
  // floating time — best effort, treat as UTC
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

/** Parse an ISO 8601 duration (P…) to milliseconds. */
export function parseIcsDuration(value: string): number {
  const m = value.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
  if (!m) return 0;
  const w = +(m[1] ?? 0);
  const d = +(m[2] ?? 0);
  const h = +(m[3] ?? 0);
  const mi = +(m[4] ?? 0);
  const s = +(m[5] ?? 0);
  return ((((w * 7 + d) * 24 + h) * 60 + mi) * 60 + s) * 1000;
}

/** Extract busy intervals from an ICS document. */
export function parseIcsBusy(ics: string): IcalBusyInterval[] {
  const out: IcalBusyInterval[] = [];
  let inEvent = false;
  let transparent = false;
  let dtstart: Date | null = null;
  let dtend: Date | null = null;
  let durationMs = 0;

  for (const line of unfoldIcs(ics)) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      transparent = false;
      dtstart = dtend = null;
      durationMs = 0;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && dtstart && !transparent) {
        const end = dtend ?? (durationMs ? new Date(dtstart.getTime() + durationMs) : null);
        if (end) out.push({ start: dtstart.toISOString(), end: end.toISOString() });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith("DTSTART")) dtstart = parseIcsDate(line);
    else if (line.startsWith("DTEND")) dtend = parseIcsDate(line);
    else if (line.startsWith("DURATION")) durationMs = parseIcsDuration(line.slice(line.indexOf(":") + 1));
    else if (line.startsWith("TRANSP") && line.includes("TRANSPARENT")) transparent = true;
  }
  return out;
}
