import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTransport } from "nodemailer";
import { getSmtpConfig, smtpConfigSchema } from "@/server/settings";
import { sendMicrosoftMail } from "@/server/microsoft-email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!currentUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }
  const rawConfig = body && typeof body === "object"
    ? (body as { config?: unknown }).config
    : undefined;
  const provider = body && typeof body === "object"
    ? (body as { provider?: unknown }).provider
    : undefined;

  if (provider === "microsoft365") {
    try {
      await sendMicrosoftMail({
        to: currentUser.email,
        subject: "Tidetime Microsoft 365 test email",
        text: "Microsoft 365 email delivery is connected and working.",
        html: [
          "<h2>Microsoft 365 is connected</h2>",
          "<p>Tidetime successfully sent this test through Microsoft Graph.</p>",
        ].join(""),
      });
      return NextResponse.json({
        ok: true,
        message: `Test email sent to ${currentUser.email}.`,
      });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          message: error instanceof Error ? error.message : "Microsoft 365 test failed",
        },
        { status: 502 },
      );
    }
  }

  if (provider !== undefined && provider !== "smtp") {
    return NextResponse.json({ ok: false, message: "Invalid email provider" }, { status: 400 });
  }
  const parsed = smtpConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid SMTP configuration" },
      { status: 400 },
    );
  }
  const current = parsed.data.pass ? null : await getSmtpConfig();
  const { host, port, user } = parsed.data;
  const pass = parsed.data.pass || current?.pass || "";

  try {
    const transport = createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 10000,
    });

    await transport.verify();
    await transport.close();

    return NextResponse.json({ ok: true, message: "Connection successful — SMTP is configured correctly." });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const msg = e.code === "ECONNREFUSED"
      ? `Connection refused — check that ${host}:${port} is reachable`
      : e.code === "EAUTH"
        ? "Authentication failed — check your username and password"
        : e.message || "Connection failed";
    return NextResponse.json({ ok: false, message: msg });
  }
}
