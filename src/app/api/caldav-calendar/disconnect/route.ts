import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { caldavAdapter } from "@/server/calendar/caldav";

export const dynamic = "force-dynamic";

/** POST /api/caldav-calendar/disconnect */
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await caldavAdapter.disconnect(user.id);
  return NextResponse.json({ ok: true });
}
