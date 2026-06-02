/**
 * Reminder worker. Processes all due reminder jobs once and exits.
 *
 * Run on a schedule (cron / systemd timer / container sidecar), e.g. every
 * minute:
 *   * * * * * cd /app && npm run jobs:reminders
 *
 * Usage:
 *   npm run jobs:reminders
 */
import { processDueReminders } from "@/server/reminders";
import { sendReviewRequests } from "@/server/reviews";
import { processDueWebhookDeliveries } from "@/server/webhooks";

async function main() {
  const result = await processDueReminders();
  console.log(
    `[reminders] processed=${result.processed} sent=${result.sent} failed=${result.failed}`,
  );
  const reviews = await sendReviewRequests();
  console.log(`[reviews] processed=${reviews.processed} sent=${reviews.sent}`);
  const webhooks = await processDueWebhookDeliveries();
  console.log(
    `[webhooks] processed=${webhooks.processed} delivered=${webhooks.delivered} failed=${webhooks.failed}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[reminders] fatal", err);
  process.exit(1);
});
