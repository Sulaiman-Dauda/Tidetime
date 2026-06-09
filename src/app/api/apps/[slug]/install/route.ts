import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getApp } from "@/app-store/registry";
import { signOAuthState } from "@/server/calendar/store";

export const dynamic = "force-dynamic";

/** GET /api/apps/[slug]/install — redirect to the app's OAuth consent page. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const app = getApp(slug);
  if (!app || !app.getInstallUrl) {
    return NextResponse.json({ error: "Unknown or non-installable app" }, { status: 404 });
  }
  if (!(await app.isConfigured())) {
    return NextResponse.json({ error: `${app.meta.name} is not configured` }, { status: 400 });
  }

  try {
    const url = await app.getInstallUrl(signOAuthState(slug, user.id));
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "App is not configured" },
      { status: 400 },
    );
  }
}
