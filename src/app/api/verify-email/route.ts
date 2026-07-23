import { NextRequest, NextResponse } from "next/server";
import { confirmEmailChange } from "@/server/email-change";
import { getAppUrl } from "@/server/app-url";

/** GET /api/verify-email?token=… — complete an email change from the emailed link. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = await confirmEmailChange(token);
  const appUrl = await getAppUrl();
  const target = result.ok
    ? `${appUrl}/dashboard/account?email_changed=1`
    : `${appUrl}/dashboard/account?email_change_error=${encodeURIComponent("error" in result ? result.error : "")}`;
  return NextResponse.redirect(target);
}
