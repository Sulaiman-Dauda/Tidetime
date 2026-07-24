import { integrationErrorMessage } from "@/server/integration-error";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createMicrosoftOAuthRequest } from "@/server/microsoft-email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const oauth = await createMicrosoftOAuthRequest(user.id);
    const response = NextResponse.redirect(oauth.url);
    const secure = req.nextUrl.protocol === "https:" ||
      req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
    const cookieOptions = {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/api/microsoft-email/callback",
      maxAge: 10 * 60,
    };
    response.cookies.set("tidetime_ms_oauth_state", oauth.state, cookieOptions);
    response.cookies.set("tidetime_ms_oauth_verifier", oauth.codeVerifier, cookieOptions);
    return response;
  } catch (error) {
    const message = integrationErrorMessage(error, "Microsoft email is not configured");
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?microsoft_error=${encodeURIComponent(message)}`, req.url),
    );
  }
}
