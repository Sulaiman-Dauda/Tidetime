import { NextRequest, NextResponse } from "next/server";
import {
  constructWebhookEvent,
  markPaymentPaid,
  markPaymentFailed,
} from "@/server/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver. Confirms or fails bookings based on PaymentIntent
 * lifecycle events. Signature is verified against STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await req.text();
  let event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid signature" },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as { id: string };
      await markPaymentPaid(intent.id);
      break;
    }
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const intent = event.data.object as { id: string };
      await markPaymentFailed(intent.id);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
