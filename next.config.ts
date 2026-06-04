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
    ...(isProd ? ["upgrade-insecure-requests"] : []),
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
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
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
  // Emit a self-contained server build for minimal Docker images.
  output: "standalone",
  async headers() {
    return [
      // Sensitive routes are protected against clickjacking.
      { source: "/", headers: protectedAreaHeaders },
      { source: "/login", headers: protectedAreaHeaders },
      { source: "/signup", headers: protectedAreaHeaders },
      { source: "/forgot-password", headers: protectedAreaHeaders },
      { source: "/reset-password", headers: protectedAreaHeaders },
      { source: "/setup", headers: protectedAreaHeaders },
      { source: "/dashboard/:path*", headers: protectedAreaHeaders },
      { source: "/api/:path*", headers: protectedAreaHeaders },
      { source: "/booking/:path*", headers: protectedAreaHeaders },
      { source: "/i/:path*", headers: protectedAreaHeaders },
      { source: "/:username", headers: protectedAreaHeaders },
      { source: "/book/:team", headers: protectedAreaHeaders },

      // Public booking pages (`/:username/:slug` and `/book/:team/:slug`) stay
      // frameable so the embeddable widget can load cross-origin.
      {
        source: "/:path*",
        headers: baseSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
