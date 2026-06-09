/**
 * Long-running background worker. Processes due reminders, review requests and
 * webhook deliveries on a fixed interval until terminated. Run it as a sidecar
 * container / systemd service alongside the web app:
 *
 *   npm run jobs:worker
 *
 * Tune the interval with WORKER_INTERVAL_MS (default 30000).
 *
 * If you prefer a platform scheduler (Vercel Cron, Cloud Scheduler, …), use the
 * authenticated POST /api/cron endpoint instead — both share an advisory lock
 * so they can safely coexist.
 */
import { runDueJobs, formatJobSummary } from "@/server/jobs";

const INTERVAL_MS = Math.max(5000, Number(process.env.WORKER_INTERVAL_MS ?? 30000));
let running = true;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tick(): Promise<void> {
  try {
    console.log(formatJobSummary(await runDueJobs()));
  } catch (err) {
    console.error("[worker] tick error", err);
  }
}

async function main(): Promise<void> {
  console.log(`[worker] started — interval ${INTERVAL_MS}ms`);
  const shutdown = (sig: string) => {
    console.log(`[worker] received ${sig}, shutting down`);
    running = false;
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  while (running) {
    await tick();
    // Sleep in small slices so shutdown is responsive.
    for (let waited = 0; running && waited < INTERVAL_MS; waited += 1000) {
      await sleep(Math.min(1000, INTERVAL_MS - waited));
    }
  }
  console.log("[worker] stopped");
  process.exit(0);
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
