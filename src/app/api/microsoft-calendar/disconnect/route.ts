import { NextResponse } from "next/server";
import { getCurrentAuthorization } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { disconnectMicrosoftCalendar } from "@/server/microsoft-calendar";

export const dynamic = "force-dynamic";

/** POST /api/microsoft-calendar/disconnect — drop the per-user credential. */
export async function POST() {
  const authorization = await getCurrentAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorization.role || !can(authorization.role, "connection.own.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await disconnectMicrosoftCalendar(authorization.user.id);
  return NextResponse.json({ ok: true });
}
