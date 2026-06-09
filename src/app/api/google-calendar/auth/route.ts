import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGoogleAuthUrl } from "@/server/google-calendar";

export const dynamic = "force-dynamic";

/** GET /api/google-calendar/auth — redirect to Google OAuth consent page. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = await getGoogleAuthUrl(user.id);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations?app_error=" +
          encodeURIComponent(err instanceof Error ? err.message : "Google is not configured"),
        req.url,
      ),
    );
  }
}
