import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSmtpConfig, setSmtpConfig, getStripeConfig, setStripeConfig } from "@/server/settings";

export const dynamic = "force-dynamic";

/**
 * These endpoints manage instance-global SMTP/Stripe credentials, so they are
 * restricted to the instance admin — not merely team managers (who manage their
 * own team, not the instance). Returns a clean 403 for everyone else.
 */
async function ensureAdmin(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** GET /api/settings?key=smtp — fetch config (passwords/keys redacted). */
export async function GET(req: NextRequest) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const key = req.nextUrl.searchParams.get("key");
  if (key === "smtp") {
    const config = await getSmtpConfig();
    // Return without the actual password for security
    return NextResponse.json({
      config: config ? { ...config, pass: config.pass ? "••••••••" : "" } : null,
    });
  }
  if (key === "stripe") {
    const config = await getStripeConfig();
    return NextResponse.json({
      config: config ? { ...config, secretKey: config.secretKey ? "••••••••" : "", webhookSecret: config.webhookSecret ? "••••••••" : "" } : null,
    });
  }
  return NextResponse.json({ error: "Unknown key" }, { status: 400 });
}

/** POST /api/settings — save config. */
export async function POST(req: NextRequest) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { key, config } = body;

  if (key === "smtp") {
    await setSmtpConfig(config);
    return NextResponse.json({ ok: true });
  }
  if (key === "stripe") {
    await setStripeConfig(config);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown key" }, { status: 400 });
}
