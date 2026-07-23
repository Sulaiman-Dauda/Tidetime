import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthorization } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { disconnectGoogleCalendar } from "@/server/google-calendar";

export const dynamic = "force-dynamic";

/** POST /api/google-calendar/disconnect */
export async function POST(_req: NextRequest) {
  const authorization = await getCurrentAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorization.role || !can(authorization.role, "connection.own.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await disconnectGoogleCalendar(authorization.user.id);
  return NextResponse.json({ ok: true });
}
