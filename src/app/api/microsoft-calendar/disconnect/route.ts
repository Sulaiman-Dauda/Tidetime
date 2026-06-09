import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { microsoftAdapter } from "@/server/calendar/microsoft";

export const dynamic = "force-dynamic";

/** POST /api/microsoft-calendar/disconnect */
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await microsoftAdapter.disconnect(user.id);
  return NextResponse.json({ ok: true });
}
