import { NextRequest, NextResponse } from "next/server";
import { exchangeMicrosoftCode } from "@/server/calendar/microsoft";
import { parseOAuthState } from "@/server/calendar/store";

export const dynamic = "force-dynamic";

/** GET /api/microsoft-calendar/callback — handle OAuth redirect from Microsoft. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?microsoft_error=" + encodeURIComponent(error), req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?microsoft_error=missing_code_or_state", req.url),
    );
  }

  const userId = parseOAuthState("microsoft", state);
  if (!userId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?microsoft_error=invalid_state", req.url),
    );
  }

  try {
    await exchangeMicrosoftCode(code, userId);
    return NextResponse.redirect(new URL("/dashboard/settings?microsoft_connected=1", req.url));
  } catch (err) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?microsoft_error=" +
          encodeURIComponent(err instanceof Error ? err.message : "Exchange failed"),
        req.url,
      ),
    );
  }
}
