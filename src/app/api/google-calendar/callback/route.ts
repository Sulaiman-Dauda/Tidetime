import { NextRequest, NextResponse } from "next/server";
import { userHasPermission } from "@/lib/guard";
import { exchangeGoogleCode, parseGoogleOAuthState } from "@/server/google-calendar";

export const dynamic = "force-dynamic";

/** GET /api/google-calendar/callback — handle OAuth redirect from Google. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?google_error=" + encodeURIComponent(error), req.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?google_error=missing_code_or_state", req.url),
    );
  }

  const userId = parseGoogleOAuthState(state);
  if (!userId) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?google_error=invalid_state", req.url),
    );
  }

  try {
    if (!(await userHasPermission(userId, "connection.own.manage"))) {
      return NextResponse.redirect(
        new URL("/dashboard/integrations?google_error=forbidden", req.url),
      );
    }
    await exchangeGoogleCode(code, userId);
    return NextResponse.redirect(new URL("/dashboard/integrations?google_connected=1", req.url));
  } catch (err) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/integrations?google_error=" +
          encodeURIComponent(err instanceof Error ? err.message : "Exchange failed"),
        req.url,
      ),
    );
  }
}
