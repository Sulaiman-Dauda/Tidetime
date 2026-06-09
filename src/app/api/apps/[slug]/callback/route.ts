import { NextRequest, NextResponse } from "next/server";
import { parseOAuthState } from "@/server/calendar/store";
import { exchangeZoomCode } from "@/app-store/zoom";
import { exchangeHubspotCode } from "@/app-store/hubspot";

export const dynamic = "force-dynamic";

/** OAuth code-exchange handlers, keyed by app slug. */
const EXCHANGERS: Record<string, (code: string, userId: number) => Promise<void>> = {
  zoom_video: exchangeZoomCode,
  hubspot: exchangeHubspotCode,
};

const DEST = "/dashboard/integrations";

function redirectWith(req: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`${DEST}?${query}`, req.url));
}

/** GET /api/apps/[slug]/callback — handle the OAuth redirect for an app. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exchange = EXCHANGERS[slug];
  if (!exchange) return redirectWith(req, "app_error=unknown_app");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) return redirectWith(req, `app_error=${encodeURIComponent(error)}`);
  if (!code || !state) return redirectWith(req, "app_error=missing_code_or_state");

  const userId = parseOAuthState(slug, state);
  if (!userId) return redirectWith(req, "app_error=invalid_state");

  try {
    await exchange(code, userId);
    return redirectWith(req, `app_connected=${encodeURIComponent(slug)}`);
  } catch (err) {
    return redirectWith(
      req,
      `app_error=${encodeURIComponent(err instanceof Error ? err.message : "Exchange failed")}`,
    );
  }
}
