import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTransport } from "nodemailer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!currentUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { config } = await req.json();
  const { host, port, user, pass } = config;

  if (!host) {
    return NextResponse.json({ ok: false, message: "SMTP host is required" });
  }

  try {
    const transport = createTransport({
      host,
      port: Number(port) || 587,
      secure: Number(port) === 465,
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
