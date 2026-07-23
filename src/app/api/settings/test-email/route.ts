import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTransport } from "nodemailer";
import { getSmtpConfig, smtpConfigSchema } from "@/server/settings";

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
