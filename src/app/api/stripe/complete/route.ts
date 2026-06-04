import { NextRequest, NextResponse } from "next/server";
import { completeBookingPayment } from "@/server/stripe";

export const dynamic = "force-dynamic";

/**
 * Public payment finaliser used by the checkout page after Stripe confirms a
 * PaymentIntent. Webhooks remain the durable source of truth; this endpoint
 * closes the UX gap so successful card payments immediately unlock the booking.
 */
export async function POST(req: NextRequest) {
  let body: { bookingUid?: string; paymentIntentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const bookingUid = typeof body.bookingUid === "string" ? body.bookingUid.trim() : "";
  const paymentIntentId = typeof body.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
  if (!bookingUid || !paymentIntentId) {
    return NextResponse.json(
      { ok: false, error: "Missing booking or payment reference" },
      { status: 400 },
    );
  }

  const result = await completeBookingPayment(bookingUid, paymentIntentId);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.status === "processing" ? 409 : 400 });
  }

  return NextResponse.json(result);
}
