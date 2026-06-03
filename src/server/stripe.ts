import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, bookings } from "@/db/schema";
import { getStripeConfig } from "@/server/settings";
import { shortId } from "@/lib/crypto";
import { computeCharge, computeRefund, mapStripeStatus } from "@/lib/payments";
import { logBookingActivity } from "./activity";

let client: Stripe | null = null;
let clientKey = "";

async function resolveStripe() {
  const dbConfig = await getStripeConfig();
  if (dbConfig?.secretKey) return dbConfig;
  return null;
}

/** Lazily construct the Stripe client from DB settings. */
export async function stripe(): Promise<Stripe> {
  const config = await resolveStripe();
  if (!config?.secretKey) {
    throw new Error("Stripe is not configured — set your keys in Settings → Payments");
  }
  const key = config.secretKey.slice(0, 12);
  if (client && clientKey === key) return client;
  client = new Stripe(config.secretKey, { apiVersion: "2026-05-27.dahlia" });
  clientKey = key;
  return client;
}

export async function isStripeEnabled(): Promise<boolean> {
  const config = await resolveStripe();
  return Boolean(config?.secretKey);
}

export interface CreatePaymentInput {
  bookingId: number;
  bookingUid: string;
  price: number;
  depositAmount: number;
  currency: string;
  description: string;
}

export interface CreatePaymentResult {
  ok: boolean;
  clientSecret?: string;
  paymentUid?: string;
  error?: string;
}

/**
 * Create a Stripe PaymentIntent for a booking and persist a pending payment
 * row. The booking stays unconfirmed until the webhook marks the payment paid.
 */
export async function createBookingPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const plan = computeCharge({
    price: input.price,
    depositAmount: input.depositAmount,
    currency: input.currency,
  });
  if (!plan) return { ok: true }; // free — nothing to charge

  if (!await isStripeEnabled()) return { ok: false, error: "Payments are not configured" };

  const uid = shortId(12);
  try {
    const intent = await (await stripe()).paymentIntents.create({
      amount: plan.amount,
      currency: plan.currency,
      description: input.description,
      metadata: { bookingUid: input.bookingUid, paymentUid: uid },
      automatic_payment_methods: { enabled: true },
    });

    await db.insert(payments).values({
      uid,
      bookingId: input.bookingId,
      amount: plan.amount,
      currency: plan.currency,
      status: "pending",
      provider: "stripe",
      externalId: intent.id,
      data: { isDeposit: plan.isDeposit, balanceDue: plan.balanceDue },
    });

    return { ok: true, clientSecret: intent.client_secret ?? undefined, paymentUid: uid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Payment failed" };
  }
}

/** Mark a payment paid and confirm its booking (idempotent). */
export async function markPaymentPaid(externalId: string): Promise<void> {
  const [pay] = await db.select().from(payments).where(eq(payments.externalId, externalId)).limit(1);
  if (!pay || pay.status === "paid") return;

  await db
    .update(payments)
    .set({ status: "paid", success: true })
    .where(eq(payments.id, pay.id));

  // Confirm the booking now that payment succeeded.
  await db
    .update(bookings)
    .set({ paid: true, status: "accepted", updatedAt: new Date() })
    .where(eq(bookings.id, pay.bookingId));

  await logBookingActivity(pay.bookingId, "payment_succeeded", {
    message: "Payment received and booking confirmed",
    data: { amount: pay.amount, currency: pay.currency },
  });
}

/** Mark a payment failed without confirming the booking. */
export async function markPaymentFailed(externalId: string): Promise<void> {
  await db.update(payments).set({ status: "failed", success: false }).where(eq(payments.externalId, externalId));
}

export interface RefundResult {
  ok: boolean;
  amount?: number;
  error?: string;
}

/** Refund a booking's payment (full or partial). */
export async function refundBookingPayment(bookingId: number, amount?: number): Promise<RefundResult> {
  const [pay] = await db.select().from(payments).where(eq(payments.bookingId, bookingId)).limit(1);
  if (!pay) return { ok: false, error: "No payment found for booking" };
  if (pay.status !== "paid") return { ok: false, error: "Payment is not in a refundable state" };
  if (!pay.externalId) return { ok: false, error: "Payment has no Stripe reference" };

  const refundAmount = computeRefund(pay.amount, amount);
  if (refundAmount <= 0) return { ok: false, error: "Nothing to refund" };

  try {
    await (await stripe()).refunds.create({ payment_intent: pay.externalId, amount: refundAmount });
    await db
      .update(payments)
      .set({ status: "refunded", refunded: true })
      .where(eq(payments.id, pay.id));
    return { ok: true, amount: refundAmount };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Refund failed" };
  }
}

/** Verify and parse a Stripe webhook event. */
export async function constructWebhookEvent(payload: string, signature: string): Promise<Stripe.Event> {
  const config = await getStripeConfig();
  if (!config?.webhookSecret) throw new Error("Stripe webhook secret is not configured");
  return (await stripe()).webhooks.constructEvent(payload, signature, config.webhookSecret);
}

export { mapStripeStatus };
