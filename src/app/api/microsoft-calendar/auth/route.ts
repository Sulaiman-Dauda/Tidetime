import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMicrosoftAuthUrl } from "@/server/calendar/microsoft";
import { signOAuthState } from "@/server/calendar/store";

export const dynamic = "force-dynamic";

/** GET /api/microsoft-calendar/auth — redirect to Microsoft consent page. */
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = await getMicrosoftAuthUrl(signOAuthState("microsoft", user.id));
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Microsoft 365 is not configured" },
      { status: 400 },
    );
  }
}
