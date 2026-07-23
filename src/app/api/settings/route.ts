import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSmtpConfig, setSmtpConfig, smtpConfigSchema } from "@/server/settings";

export const dynamic = "force-dynamic";

/**
 * These endpoints manage instance-global SMTP credentials, so they are
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
    // Never return the stored password. An empty password on save preserves it.
    return NextResponse.json({
      config: config
        ? { ...config, pass: "", passwordConfigured: Boolean(config.pass) }
        : null,
    });
  }
  return NextResponse.json({ error: "Unknown key" }, { status: 400 });
}

/** POST /api/settings — save config. */
export async function POST(req: NextRequest) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { key, config } = body as { key?: unknown; config?: unknown };

  if (key === "smtp") {
    const parsed = smtpConfigSchema.safeParse(config);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid SMTP configuration" },
        { status: 400 },
      );
    }
    await setSmtpConfig(parsed.data);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown key" }, { status: 400 });
}
