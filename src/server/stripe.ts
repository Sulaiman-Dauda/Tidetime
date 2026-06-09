import "server-only";
import Stripe from "stripe";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { payments, bookings, eventTypes } from "@/db/schema";
import { getStripeConfig } from "@/server/settings";
import { shortId } from "@/lib/crypto";
import { computeCharge, computeRefund, mapStripeStatus } from "@/lib/payments";
import { logBookingActivity } from "./activity";
import { runAcceptedBookingEffects, runPendingApprovalEffects } from "./booking-effects";

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
  return Boolean(config?.publishableKey && config?.secretKey && config?.webhookSecret);
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
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
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

/** Mark a payment paid and advance its booking to the correct next state. */
export async function markPaymentPaid(externalId: string): Promise<void> {
  const [pay] = await db.select().from(payments).where(eq(payments.externalId, externalId)).limit(1);
  if (!pay || pay.status === "paid") return;

  const [bookingRow] = await db
    .select({
      id: bookings.id,
      eventTypeId: bookings.eventTypeId,
      requiresConfirmation: eventTypes.requiresConfirmation,
    })
    .from(bookings)
    .leftJoin(eventTypes, eq(bookings.eventTypeId, eventTypes.id))
    .where(eq(bookings.id, pay.bookingId))
    .limit(1);
  if (!bookingRow) return;

  const nextStatus = bookingRow.requiresConfirmation ? "pending" : "accepted";

  // Atomically claim the paid transition. The browser (`/api/stripe/complete`)
  // and the Stripe webhook both call this on success, so without a conditional
  // flip both could pass the read-guard above and run the booking effects twice
  // (duplicate emails, calendar invites, conferencing rooms). Only the caller
  // whose UPDATE actually changes a row from non-paid → paid proceeds.
  const claimed = await db.transaction(async (tx) => {
    const updated = await tx
      .update(payments)
      .set({ status: "paid", success: true })
      .where(and(eq(payments.id, pay.id), ne(payments.status, "paid")))
      .returning({ id: payments.id });
    if (updated.length === 0) return false;

    await tx
      .update(bookings)
      .set({ paid: true, status: nextStatus, updatedAt: new Date() })
      .where(eq(bookings.id, pay.bookingId));
    return true;
  });

  if (!claimed) return;

  await logBookingActivity(pay.bookingId, "payment_succeeded", {
    message:
      nextStatus === "accepted"
        ? "Payment received and booking confirmed"
        : "Payment received; awaiting host approval",
    data: { amount: pay.amount, currency: pay.currency },
  });

  if (nextStatus === "accepted") {
    await runAcceptedBookingEffects(pay.bookingId);
  } else {
    await runPendingApprovalEffects(pay.bookingId);
  }
}

/** Mark a payment failed without confirming the booking. */
export async function markPaymentFailed(externalId: string): Promise<void> {
  await db
    .update(payments)
    .set({ status: "failed", success: false })
    .where(eq(payments.externalId, externalId));
}

export interface CompletePaymentResult {
  ok: boolean;
  status?: "succeeded" | "processing";
  error?: string;
}

/** Verify a PaymentIntent belongs to the booking and finalise it if succeeded. */
export async function completeBookingPayment(
  bookingUid: string,
  paymentIntentId: string,
): Promise<CompletePaymentResult> {
  try {
    const intent = await (await stripe()).paymentIntents.retrieve(paymentIntentId);
    if (intent.metadata?.bookingUid !== bookingUid) {
      return { ok: false, error: "This payment does not match the booking." };
    }

    if (intent.status === "succeeded") {
      await markPaymentPaid(intent.id);
      return { ok: true, status: "succeeded" };
    }

    if (intent.status === "processing") {
      return { ok: false, status: "processing", error: "Payment is still processing." };
    }

    if (intent.status === "canceled") {
      await markPaymentFailed(intent.id);
      return { ok: false, error: "Payment was cancelled." };
    }

    return { ok: false, error: "Payment has not completed yet." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not verify payment" };
  }
}

export interface RefundResult {
  ok: boolean;
  amount?: number;
  error?: string;
}

/** Refund a booking's payment (full or partial). */
export async function refundBookingPayment(bookingId: number, amount?: number): Promise<RefundResult> {
  const [pay] = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
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
