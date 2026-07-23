import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

function buildCsp({ frameAncestors }: { frameAncestors?: string }): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    `connect-src 'self' https:${isProd ? "" : " http: ws: wss:"}`,
    "manifest-src 'self'",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    ...(frameAncestors ? [`frame-ancestors ${frameAncestors}`] : []),
    // No upgrade-insecure-requests: headers are baked into the prebuilt image,
    // which must also serve plain-HTTP installs (fresh VPS, no domain yet) —
    // the directive makes browsers rewrite every asset fetch to https://,
    // breaking all CSS/JS there. On HTTPS deployments assets are same-origin
    // and already https, so the directive adds nothing; HSTS covers downgrade.
  ];

  return directives.join("; ");
}

/**
 * Security headers applied to every response. These provide defence-in-depth
 * against clickjacking, MIME sniffing, referrer leakage and protocol downgrade.
 * HSTS is only meaningful over HTTPS, so it is enabled in production.
 */
const baseSecurityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp({}) },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const protectedAreaHeaders = [
  ...baseSecurityHeaders.filter((header) => header.key !== "Content-Security-Policy"),
  { key: "Content-Security-Policy", value: buildCsp({ frameAncestors: "'self'" }) },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  experimental: {
    // Trades a little build speed for a much smaller compile-time memory peak,
    // so self-hosters on 1–2GB VPSes can build without exotic swap setups.
    webpackMemoryOptimizations: true,
  },
  output: "standalone",
  async headers() {
    return [
      { source: "/:path*", headers: protectedAreaHeaders },
    ];
  },
};

export default nextConfig;
