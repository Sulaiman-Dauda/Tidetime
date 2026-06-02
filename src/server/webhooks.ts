import "server-only";
import { and, asc, eq, lte, lt } from "drizzle-orm";
import { db } from "@/db";
import { webhooks, webhookDeliveries } from "@/db/schema";
import { hmacSign } from "@/lib/crypto";
import {
  WEBHOOK_MAX_ATTEMPTS,
  isDeliverySuccess,
  nextDeliveryState,
} from "@/lib/webhooks";

export type WebhookTrigger =
  | "booking_created"
  | "booking_rescheduled"
  | "booking_cancelled"
  | "booking_rejected"
  | "booking_requested"
  | "meeting_started"
  | "meeting_ended";

/**
 * Enqueue a webhook event for every matching subscriber, then attempt delivery
 * immediately. Failed attempts are retried later by `processDueWebhookDeliveries`
 * with exponential backoff, so transient subscriber outages don't drop events.
 */
export async function dispatchWebhook(
  userId: number,
  trigger: WebhookTrigger,
  payload: Record<string, unknown>,
): Promise<void> {
  const subs = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.userId, userId), eq(webhooks.active, true)));

  const matching = subs.filter((w) => w.triggers.includes(trigger));
  if (matching.length === 0) return;

  const body = { triggerEvent: trigger, createdAt: new Date().toISOString(), payload };

  const inserted = await db
    .insert(webhookDeliveries)
    .values(
      matching.map((w) => ({
        webhookId: w.id,
        trigger,
        payload: body,
        maxAttempts: WEBHOOK_MAX_ATTEMPTS,
      })),
    )
    .returning({ id: webhookDeliveries.id });

  // Best-effort immediate delivery; anything still pending is picked up by cron.
  await Promise.allSettled(inserted.map((d) => attemptDelivery(d.id)));
}

type DeliveryRow = typeof webhookDeliveries.$inferSelect;

/** POST a single queued delivery and persist the resulting state. */
async function attemptDelivery(deliveryId: number): Promise<void> {
  const [row] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);
  if (!row || row.status !== "pending") return;

  const [hook] = await db.select().from(webhooks).where(eq(webhooks.id, row.webhookId)).limit(1);
  // Subscriber was deleted (cascade should remove the delivery, but guard anyway).
  if (!hook) {
    await db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, row.id));
    return;
  }

  const attempts = row.attempts + 1;
  const { ok, statusCode, error } = await sendOnce(hook.subscriberUrl, hook.secret, row);
  const state = nextDeliveryState({
    attempts,
    maxAttempts: row.maxAttempts,
    ok,
    now: Date.now(),
  });

  await db
    .update(webhookDeliveries)
    .set({
      attempts,
      status: state.status,
      nextAttemptAt: state.nextAttemptAt,
      lastStatusCode: statusCode ?? null,
      lastError: error ?? null,
      deliveredAt: state.status === "success" ? new Date() : null,
    })
    .where(eq(webhookDeliveries.id, row.id));
}

/** Perform the actual HTTP POST with an optional HMAC signature. */
async function sendOnce(
  url: string,
  secret: string | null,
  row: DeliveryRow,
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  const body = JSON.stringify(row.payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Tidetime-Signature-256"] = `sha256=${hmacSign(body, secret)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
    clearTimeout(timer);
    return { ok: isDeliverySuccess(res.status), statusCode: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Cron worker: retry all pending deliveries whose backoff window has elapsed.
 * Run alongside the reminder worker.
 */
export async function processDueWebhookDeliveries(limit = 100): Promise<{
  processed: number;
  delivered: number;
  failed: number;
}> {
  const due = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "pending"),
        lte(webhookDeliveries.nextAttemptAt, new Date()),
        lt(webhookDeliveries.attempts, webhookDeliveries.maxAttempts),
      ),
    )
    .orderBy(asc(webhookDeliveries.nextAttemptAt))
    .limit(limit);

  let delivered = 0;
  let failed = 0;
  for (const d of due) {
    await attemptDelivery(d.id);
    const [after] = await db
      .select({ status: webhookDeliveries.status })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, d.id))
      .limit(1);
    if (after?.status === "success") delivered++;
    else if (after?.status === "failed") failed++;
  }

  return { processed: due.length, delivered, failed };
}
