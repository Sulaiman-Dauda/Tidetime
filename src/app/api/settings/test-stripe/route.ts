import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/guard";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await requirePermission("team.manage");

  const { secretKey } = await req.json();

  if (!secretKey || !secretKey.startsWith("sk_")) {
    return NextResponse.json({ ok: false, message: "Invalid secret key — must start with sk_" });
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" });
    await stripe.balance.retrieve();
    return NextResponse.json({ ok: true, message: "Connection successful — Stripe is configured correctly." });
  } catch (err) {
    const e = err as { type?: string; message?: string };
    const msg = e.type === "StripeAuthenticationError"
      ? "Invalid API key — check your secret key"
      : e.message || "Connection failed";
    return NextResponse.json({ ok: false, message: msg });
  }
}
