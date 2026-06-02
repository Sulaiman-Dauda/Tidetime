/**
 * Pure helpers for the durable webhook delivery queue. Kept free of database
 * and network side effects so the retry policy is fully testable.
 */

/** Base delay before the first retry (ms). */
export const WEBHOOK_BASE_DELAY_MS = 60_000;
/** Upper bound on any single backoff interval (ms). */
export const WEBHOOK_MAX_DELAY_MS = 6 * 60 * 60 * 1000; // 6 hours
/** Default attempts before a delivery is marked permanently failed. */
export const WEBHOOK_MAX_ATTEMPTS = 5;

/**
 * Exponential backoff for the next retry after `attempts` failed attempts.
 * attempts=1 → base, attempts=2 → 2×base, … capped at WEBHOOK_MAX_DELAY_MS.
 */
export function nextBackoffMs(attempts: number): number {
  if (attempts <= 0) return WEBHOOK_BASE_DELAY_MS;
  const delay = WEBHOOK_BASE_DELAY_MS * 2 ** (attempts - 1);
  return Math.min(delay, WEBHOOK_MAX_DELAY_MS);
}

/** Whether an HTTP status code counts as a successful delivery. */
export function isDeliverySuccess(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

/** Compute the next delivery state after an attempt resolves. */
export function nextDeliveryState(input: {
  attempts: number;
  maxAttempts: number;
  ok: boolean;
  now: number;
}): { status: "success" | "failed" | "pending"; nextAttemptAt: Date } {
  const attempts = input.attempts;
  if (input.ok) {
    return { status: "success", nextAttemptAt: new Date(input.now) };
  }
  if (attempts >= input.maxAttempts) {
    return { status: "failed", nextAttemptAt: new Date(input.now) };
  }
  return { status: "pending", nextAttemptAt: new Date(input.now + nextBackoffMs(attempts)) };
}
