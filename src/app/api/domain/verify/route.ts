import { NextResponse } from "next/server";
import { getCustomDomain } from "@/server/app-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Caddy's on-demand TLS "ask" endpoint. Before obtaining a certificate for a
 * hostname, the bundled Caddy proxy calls GET /api/domain/verify?domain=<host>
 * and only proceeds on a 200. We answer 200 solely for the custom domain
 * saved in Settings, so the server can't be tricked into requesting
 * certificates for arbitrary hostnames pointed at its IP.
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get("domain")?.toLowerCase();
  if (!domain) {
    return new NextResponse(null, { status: 400 });
  }
  const configured = await getCustomDomain();
  if (configured && domain === configured) {
    return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}
