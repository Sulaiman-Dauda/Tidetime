import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGoogleAuthUrl } from "@/server/google-calendar";

export const dynamic = "force-dynamic";

/** GET /api/google-calendar/auth — redirect to Google OAuth consent page. */
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = getGoogleAuthUrl(user.id);
  return NextResponse.redirect(url);
}
