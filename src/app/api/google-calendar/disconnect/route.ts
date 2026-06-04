import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { disconnectGoogleCalendar } from "@/server/google-calendar";

export const dynamic = "force-dynamic";

/** POST /api/google-calendar/disconnect */
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await disconnectGoogleCalendar(user.id);
  return NextResponse.json({ ok: true });
}
