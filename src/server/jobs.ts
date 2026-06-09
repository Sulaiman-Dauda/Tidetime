import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { processDueReminders } from "./reminders";
import { sendReviewRequests } from "./reviews";
import { processDueWebhookDeliveries } from "./webhooks";
import { runRetentionCleanup, type RetentionSummary } from "./retention";

/**
 * Background job orchestration. Both the long-running worker
 * (scripts/worker.ts) and the HTTP cron trigger (/api/cron) call runDueJobs().
 *
 * A Postgres session-level advisory lock guarantees that overlapping ticks — or
 * a worker plus an external scheduler hitting the endpoint at the same time —
 * never process the same jobs twice.
 */

// Arbitrary, stable 64-bit key for this app's job lock.
const JOB_LOCK_KEY = 481516234299;

async function tryAdvisoryLock(): Promise<boolean> {
  const rows = (await db.execute(
    sql`SELECT pg_try_advisory_lock(${JOB_LOCK_KEY}) AS locked`,
  )) as unknown as { locked: boolean }[];
  return Boolean(rows[0]?.locked);
}

async function advisoryUnlock(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${JOB_LOCK_KEY})`);
}

export interface JobRunSummary {
  skipped: boolean;
  reminders?: { processed: number; sent: number; failed: number };
  reviews?: { processed: number; sent: number };
  webhooks?: { processed: number; delivered: number; failed: number };
  retention?: RetentionSummary;
}

/** Process every due job once, guarded by an advisory lock. */
export async function runDueJobs(): Promise<JobRunSummary> {
  const locked = await tryAdvisoryLock();
  if (!locked) return { skipped: true };
  try {
    const reminders = await processDueReminders();
    const reviews = await sendReviewRequests();
    const webhooks = await processDueWebhookDeliveries();
    const retention = await runRetentionCleanup();
    return { skipped: false, reminders, reviews, webhooks, retention };
  } finally {
    await advisoryUnlock().catch(() => undefined);
  }
}

export function formatJobSummary(s: JobRunSummary): string {
  if (s.skipped) return "[jobs] skipped (another run holds the lock)";
  const r = s.retention;
  return (
    `[jobs] reminders processed=${s.reminders?.processed ?? 0} sent=${s.reminders?.sent ?? 0} failed=${s.reminders?.failed ?? 0}` +
    ` | reviews processed=${s.reviews?.processed ?? 0} sent=${s.reviews?.sent ?? 0}` +
    ` | webhooks processed=${s.webhooks?.processed ?? 0} delivered=${s.webhooks?.delivered ?? 0} failed=${s.webhooks?.failed ?? 0}` +
    ` | retention sessions=${r?.sessions ?? 0} tokens=${r?.verificationTokens ?? 0} cache=${r?.calendarCache ?? 0} drafts=${r?.draftEventTypes ?? 0} bookings=${r?.bookings ?? 0}`
  );
}
