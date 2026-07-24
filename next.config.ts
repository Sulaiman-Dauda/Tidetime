import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Security headers applied to every response. These provide defence-in-depth
 * against clickjacking, MIME sniffing, referrer leakage and protocol downgrade.
 * The Content-Security-Policy lives in src/proxy.ts so each document gets a
 * per-request script nonce. HSTS is only meaningful over HTTPS, so it is
 * enabled in production.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
