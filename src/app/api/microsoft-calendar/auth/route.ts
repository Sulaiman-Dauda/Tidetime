import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthorization } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { createMicrosoftCalendarOAuthRequest } from "@/server/microsoft-calendar";

export const dynamic = "force-dynamic";

/** GET /api/microsoft-calendar/auth — start the per-user consent flow. */
export async function GET(req: NextRequest) {
  const authorization = await getCurrentAuthorization();
  if (!authorization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authorization.role || !can(authorization.role, "connection.own.manage")) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?ms_calendar_error=forbidden", req.url),
    );
  }

  try {
    const oauth = await createMicrosoftCalendarOAuthRequest();
    const response = NextResponse.redirect(oauth.url);
    const secure = req.nextUrl.protocol === "https:" ||
      req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
    const cookieOptions = {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/api/microsoft-calendar/callback",
      maxAge: 10 * 60,
    };
    response.cookies.set("tidetime_mscal_state", oauth.state, cookieOptions);
    response.cookies.set("tidetime_mscal_verifier", oauth.codeVerifier, cookieOptions);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Microsoft 365 is not configured";
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?ms_calendar_error=${encodeURIComponent(message)}`, req.url),
    );
  }
}
