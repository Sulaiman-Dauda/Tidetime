import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/guard";
import { getSmtpConfig, setSmtpConfig, getStripeConfig, setStripeConfig } from "@/server/settings";

export const dynamic = "force-dynamic";

/** GET /api/settings?key=smtp — fetch config (passwords/keys redacted). */
export async function GET(req: NextRequest) {
  await requirePermission("team.manage");

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
  await requirePermission("team.manage");

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
