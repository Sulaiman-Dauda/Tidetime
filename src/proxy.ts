import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content-Security-Policy with a script nonce. Living here (the
 * Next proxy) instead of next.config.ts lets every document response carry a
 * fresh nonce, so production needs no 'unsafe-inline' scripts: an injected
 * <script> without the nonce simply never runs. Next reads the CSP request
 * header and stamps the nonce onto its own inline bootstrap scripts; app code
 * reads it via headers().get("x-nonce") where needed (e.g. the theme script).
 */

const isProd = process.env.NODE_ENV === "production";

function buildCsp(nonce: string): string {
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : // Dev needs eval + inline for react-refresh and turbopack.
      "'self' 'unsafe-inline' 'unsafe-eval'";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    `connect-src 'self' https:${isProd ? "" : " http: ws: wss:"}`,
    "manifest-src 'self'",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    // No upgrade-insecure-requests: the prebuilt image must also serve
    // plain-HTTP installs (fresh VPS, no domain yet) — the directive would
    // rewrite every asset fetch to https:// and break all CSS/JS there. On
    // HTTPS deployments assets are same-origin and already https, so it adds
    // nothing; HSTS covers downgrade.
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Documents only: static assets and API responses don't execute scripts, and
  // prefetched RSC payloads are not documents either.
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|fonts|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
