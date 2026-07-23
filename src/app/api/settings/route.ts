import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMicrosoftCallbackUrl } from "@/server/microsoft-email";
import {
  emailProviderSchema,
  getEmailProvider,
  getMicrosoftEmailConfig,
  getMicrosoftEmailConnection,
  getSmtpConfig,
  microsoftEmailConfigSchema,
  setEmailProvider,
  setMicrosoftEmailConfig,
  setSmtpConfig,
  smtpConfigSchema,
} from "@/server/settings";

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

/** GET /api/settings — fetch email config with every secret redacted. */
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
  if (key === "email") {
    const [provider, smtp, microsoft, connection, callbackUrl] = await Promise.all([
      getEmailProvider(),
      getSmtpConfig(),
      getMicrosoftEmailConfig(),
      getMicrosoftEmailConnection(),
      getMicrosoftCallbackUrl(),
    ]);
    return NextResponse.json({
      provider,
      callbackUrl,
      smtp: smtp
        ? { ...smtp, pass: "", passwordConfigured: Boolean(smtp.pass) }
        : null,
      microsoft: microsoft
        ? {
            tenantId: microsoft.tenantId,
            clientId: microsoft.clientId,
            clientSecret: "",
            secretConfigured: Boolean(microsoft.clientSecret),
            fromName: microsoft.fromName,
          }
        : null,
      microsoftConnection: connection
        ? {
            connected: true,
            account: connection.account,
          }
        : { connected: false, account: null },
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
  if (key === "microsoft365") {
    const parsed = microsoftEmailConfigSchema.safeParse(config);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid Microsoft 365 configuration" },
        { status: 400 },
      );
    }
    try {
      await setMicrosoftEmailConfig(parsed.data);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not save Microsoft settings" },
        { status: 400 },
      );
    }
  }
  if (key === "email_provider") {
    const parsed = emailProviderSchema.safeParse(
      config && typeof config === "object"
        ? (config as { provider?: unknown }).provider
        : undefined,
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email provider" }, { status: 400 });
    }
    if (parsed.data === "microsoft365" && !(await getMicrosoftEmailConnection())) {
      return NextResponse.json(
        { error: "Connect a Microsoft 365 mailbox before activating it" },
        { status: 409 },
      );
    }
    if (parsed.data === "smtp" && !(await getSmtpConfig())) {
      return NextResponse.json(
        { error: "Save the SMTP configuration before activating it" },
        { status: 409 },
      );
    }
    await setEmailProvider(parsed.data);
    return NextResponse.json({ ok: true, provider: parsed.data });
  }
  return NextResponse.json({ error: "Unknown key" }, { status: 400 });
}
