import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getUpdateStatus,
  requestUpdate,
  MANUAL_UPDATE_COMMAND,
} from "@/server/updates";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await getUpdateStatus());
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let action = "check";
  try {
    const body = (await req.json()) as { action?: string };
    if (body?.action) action = body.action;
  } catch {
    // no body — default to a check
  }

  if (action === "update") {
    const status = await getUpdateStatus();
    if (!status.updateAvailable) {
      return NextResponse.json({ ok: false, message: "Already up to date." }, { status: 409 });
    }
    const { triggered } = await requestUpdate();
    return NextResponse.json({
      ok: true,
      triggered,
      command: triggered ? null : MANUAL_UPDATE_COMMAND,
    });
  }

  // Default: force a fresh check.
  return NextResponse.json(await getUpdateStatus(true));
}
