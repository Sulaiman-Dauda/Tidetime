import { NextResponse } from "next/server";
import { getCurrentAuthorization } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getMicrosoftEmailConfig } from "@/server/settings";
import {
  hasExpiredMicrosoftCalendarCredential,
  isMicrosoftCalendarConnected,
} from "@/server/microsoft-calendar";

export const dynamic = "force-dynamic";

/** GET /api/microsoft-calendar/status — connection state for the settings card. */
export async function GET() {
  const authorization = await getCurrentAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorization.role || !can(authorization.role, "connection.own.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = authorization.user.id;
  const [connected, expired, config] = await Promise.all([
    isMicrosoftCalendarConnected(userId),
    hasExpiredMicrosoftCalendarCredential(userId),
    getMicrosoftEmailConfig(),
  ]);
  return NextResponse.json({ connected, expired, configured: Boolean(config) });
}
