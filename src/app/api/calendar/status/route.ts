import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listCalendarConnections } from "@/server/calendar";
import { isMicrosoftConfigured } from "@/server/calendar/microsoft";

export const dynamic = "force-dynamic";

/** GET /api/calendar/status — connection status for every calendar provider. */
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await listCalendarConnections(user.id);
  return NextResponse.json({
    connections,
    microsoftConfigured: isMicrosoftConfigured(),
  });
}
