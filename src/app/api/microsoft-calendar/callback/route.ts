import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthorization } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { exchangeMicrosoftCalendarCode } from "@/server/microsoft-calendar";

export const dynamic = "force-dynamic";

function settingsUrl(req: NextRequest, params: Record<string, string>): URL {
  const url = new URL("/dashboard/integrations", req.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

/** GET /api/microsoft-calendar/callback — complete the consent flow. */
export async function GET(req: NextRequest) {
  const clearCookies = (response: NextResponse) => {
    response.cookies.delete("tidetime_mscal_state");
    response.cookies.delete("tidetime_mscal_verifier");
    return response;
  };

  const authorization = await getCurrentAuthorization();
  if (!authorization?.role || !can(authorization.role, "connection.own.manage")) {
    return clearCookies(NextResponse.redirect(settingsUrl(req, { ms_calendar_error: "forbidden" })));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get("tidetime_mscal_state")?.value;
  const codeVerifier = req.cookies.get("tidetime_mscal_verifier")?.value;

  if (oauthError) {
    return clearCookies(NextResponse.redirect(settingsUrl(req, { ms_calendar_error: oauthError })));
  }
  if (!code || !state || !cookieState || state !== cookieState || !codeVerifier) {
    return clearCookies(NextResponse.redirect(settingsUrl(req, { ms_calendar_error: "invalid_state" })));
  }

  try {
    await exchangeMicrosoftCalendarCode(authorization.user.id, code, codeVerifier);
    return clearCookies(NextResponse.redirect(settingsUrl(req, { ms_calendar_connected: "1" })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return clearCookies(NextResponse.redirect(settingsUrl(req, { ms_calendar_error: message })));
  }
}
