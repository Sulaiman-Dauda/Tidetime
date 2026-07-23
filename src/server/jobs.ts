import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
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
  webhooks?: { processed: number; delivered: number; failed: number };
  retention?: RetentionSummary;
}

/** Process every due job once, guarded by an advisory lock. */
export async function runDueJobs(): Promise<JobRunSummary> {
  const locked = await tryAdvisoryLock();
  if (!locked) return { skipped: true };
  try {
    const webhooks = await processDueWebhookDeliveries();
    const retention = await runRetentionCleanup();
    return { skipped: false, webhooks, retention };
  } finally {
    await advisoryUnlock().catch(() => undefined);
  }
}
