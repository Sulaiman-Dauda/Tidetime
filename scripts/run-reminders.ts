/**
 * One-shot job runner. Processes all due reminders, review requests and webhook
 * deliveries once, then exits. Suitable for a classic cron entry:
 *
 *   * * * * * cd /app && npm run jobs:reminders
 *
 * For a self-managed loop use `npm run jobs:worker`; for a platform scheduler
 * use the POST /api/cron endpoint. All three share an advisory lock.
 */
import { runDueJobs, formatJobSummary } from "@/server/jobs";

async function main() {
  console.log(formatJobSummary(await runDueJobs()));
  process.exit(0);
}

main().catch((err) => {
  console.error("[jobs] fatal", err);
  process.exit(1);
});
