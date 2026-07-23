import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthorization } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getGoogleAuthUrl } from "@/server/google-calendar";

export const dynamic = "force-dynamic";

/** GET /api/google-calendar/auth — redirect to Google OAuth consent page. */
export async function GET(req: NextRequest) {
  const authorization = await getCurrentAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !authorization.role ||
    !can(authorization.role, "connection.own.manage")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = await getGoogleAuthUrl(authorization.user.id);
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
