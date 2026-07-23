import { addDaysToKey, formatDateKey, getZonedParts } from "./time";

/** Render a UTC instant as a localized time string in a given zone. */
function formatTime(date: Date, timeZone: string, hour12 = true): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12,
  }).format(date);
}

/** Render a full date+time range, e.g. "Mon, Jun 1 · 9:00–9:30 AM (GMT+1)". */
export function formatRange(start: Date, end: Date, timeZone: string, hour12 = true): string {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
  const s = formatTime(start, timeZone, hour12);
  const e = formatTime(end, timeZone, hour12);
  return `${date} · ${s} – ${e}`;
}

/** Human duration label, e.g. 90 → "1h 30m". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayLabel(day: number): string {
  return WEEKDAY_LABELS[day] ?? "";
}

/** Initials from a display name for avatar fallbacks. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Build "YYYY-MM-DD" for "today" in a viewer's zone. */
function todayKey(timeZone: string): string {
  const p = getZonedParts(new Date(), timeZone);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Human booking-page label for the next available slot in a timezone. */
export function formatNextAvailable(date: Date, timeZone: string, hour12 = true): string {
  const key = formatDateKey(date, timeZone);
  const today = todayKey(timeZone);
  const tomorrow = addDaysToKey(today, 1);
  const time = formatTime(date, timeZone, hour12);

  if (key === today) return `Today · ${time}`;
  if (key === tomorrow) return `Tomorrow · ${time}`;

  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  return `${label} · ${time}`;
}
