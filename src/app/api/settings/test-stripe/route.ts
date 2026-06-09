import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import Stripe from "stripe";
import { getStripeConfig } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { secretKey } = await req.json();
  const resolved =
    secretKey === "••••••••" ? (await getStripeConfig())?.secretKey ?? "" : String(secretKey ?? "");

  if (!resolved || !resolved.startsWith("sk_")) {
    return NextResponse.json({ ok: false, message: "Invalid secret key — must start with sk_" });
  }

  try {
    const stripe = new Stripe(resolved, { apiVersion: "2026-05-27.dahlia" });
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
