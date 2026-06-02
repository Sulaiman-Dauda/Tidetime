import type { NextConfig } from "next";

/**
 * Security headers applied to every response. These provide defence-in-depth
 * against clickjacking, MIME sniffing, referrer leakage and protocol downgrade.
 * HSTS is only meaningful over HTTPS, so it is enabled in production.
 */
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const protectedAreaHeaders = [
  ...baseSecurityHeaders,
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
