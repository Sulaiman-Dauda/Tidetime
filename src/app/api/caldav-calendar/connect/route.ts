import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectCaldav } from "@/server/calendar/caldav";

export const dynamic = "force-dynamic";

/**
 * POST /api/caldav-calendar/connect
 * Body: { serverUrl, username, password }
 * For Apple iCloud use serverUrl "https://caldav.icloud.com" with an
 * app-specific password.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    serverUrl?: string;
    username?: string;
    password?: string;
  };
  const serverUrl = (body.serverUrl ?? "").trim();
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!serverUrl || !username || !password) {
    return NextResponse.json(
      { error: "serverUrl, username and password are required" },
      { status: 400 },
    );
  }
  if (!/^https?:\/\//i.test(serverUrl)) {
    return NextResponse.json({ error: "serverUrl must be an http(s) URL" }, { status: 400 });
  }

  try {
    await connectCaldav(user.id, serverUrl, username, password);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not connect — check the server URL and credentials." },
      { status: 400 },
    );
  }
}
