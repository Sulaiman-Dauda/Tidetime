import type { RecurringRule } from "@/db/schema";

/** Hard ceiling on how many occurrences a single series may create. */
export const MAX_RECURRENCE_COUNT = 52;

/** Clamp a stored/blob recurring rule into a safe, well-formed rule (or null). */
export function normalizeRecurringRule(
  rule: RecurringRule | null | undefined,
): RecurringRule | null {
  if (!rule) return null;
  if (rule.freq !== "weekly" && rule.freq !== "monthly") return null;
  const interval = Math.min(12, Math.max(1, Math.floor(Number(rule.interval) || 1)));
  const count = Math.min(MAX_RECURRENCE_COUNT, Math.max(1, Math.floor(Number(rule.count) || 1)));
  return { freq: rule.freq, interval, count };
}

/**
 * Expand a recurring rule into concrete UTC start dates beginning at `start`.
 * Weekly steps advance by whole weeks; monthly steps advance by whole months.
 * Times are kept identical in UTC (callers store UTC) — a lean choice that keeps
 * the wall-clock time stable except across DST transitions.
 */
export function expandRecurrence(
  start: Date,
  rule: RecurringRule | null | undefined,
  max = MAX_RECURRENCE_COUNT,
): Date[] {
  const normalized = normalizeRecurringRule(rule);
  if (!normalized) return [new Date(start)];
  const count = Math.min(normalized.count, Math.max(1, max));
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    if (normalized.freq === "weekly") {
      d.setUTCDate(d.getUTCDate() + i * normalized.interval * 7);
    } else {
      d.setUTCMonth(d.getUTCMonth() + i * normalized.interval);
    }
    out.push(d);
  }
  return out;
}

/** Human-readable summary, e.g. "Repeats every 2 weeks, 6 times". */
export function describeRecurrence(rule: RecurringRule | null | undefined): string {
  const r = normalizeRecurringRule(rule);
  if (!r) return "";
  const unit = r.freq === "weekly" ? "week" : "month";
  const every = r.interval === 1 ? `every ${unit}` : `every ${r.interval} ${unit}s`;
  return `Repeats ${every}, ${r.count} time${r.count === 1 ? "" : "s"}`;
}
