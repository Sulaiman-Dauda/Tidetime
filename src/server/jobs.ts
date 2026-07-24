import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { processDueWebhookDeliveries } from "./webhooks";
import { runRetentionCleanup, type RetentionSummary } from "./retention";

/**
 * Background job orchestration. Both the long-running worker
 * (scripts/jobs-worker.mjs) and the HTTP cron trigger (/api/cron) call
 * runDueJobs().
 *
 * A transaction-scoped advisory lock (pg_try_advisory_xact_lock) guarantees
 * that overlapping ticks — or a worker plus an external scheduler hitting the
 * endpoint at the same time — never process the same jobs twice. The lock is
 * pinned to the transaction's connection and released automatically on
 * commit/rollback, so it cannot leak across the connection pool.
 */

// Arbitrary, stable 64-bit key for this app's job lock.
const JOB_LOCK_KEY = 481516234299;

export interface JobRunSummary {
  skipped: boolean;
  webhooks?: { processed: number; delivered: number; failed: number };
  retention?: RetentionSummary;
}

/** Process every due job once, guarded by an advisory lock. */
export async function runDueJobs(): Promise<JobRunSummary> {
  return db.transaction(async (tx) => {
    const rows = (await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(${JOB_LOCK_KEY}) AS locked`,
    )) as unknown as { locked: boolean }[];
    if (!rows[0]?.locked) return { skipped: true };
    const webhooks = await processDueWebhookDeliveries();
    const retention = await runRetentionCleanup();
    return { skipped: false, webhooks, retention };
  });
}
