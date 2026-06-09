/**
 * Pure Microsoft Graph calendar helpers, split out from the server adapter so
 * their date/timezone handling can be unit-tested without a live Graph token.
 */

/** Graph wants a wall-clock datetime + an explicit zone. We anchor to UTC. */
export function graphDateTime(d: Date): { dateTime: string; timeZone: string } {
  return { dateTime: d.toISOString().replace("Z", ""), timeZone: "UTC" };
}

/**
 * Normalise a Graph dateTimeTimeZone value to a real ISO string. With the
 * `Prefer: outlook.timezone="UTC"` header Graph returns UTC times *without* a
 * trailing Z, so we add one when no zone designator is present.
 */
export function parseGraphDate(value?: { dateTime?: string; timeZone?: string }): string | null {
  if (!value?.dateTime) return null;
  const raw = value.dateTime;
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** showAs values that should count as busy for availability purposes. */
const GRAPH_BUSY_STATES = new Set(["busy", "oof", "workingElsewhere", "tentative"]);

export function isGraphEventBusy(ev: { showAs?: string; isCancelled?: boolean }): boolean {
  if (ev.isCancelled) return false;
  if (ev.showAs && !GRAPH_BUSY_STATES.has(ev.showAs)) return false;
  return true;
}
