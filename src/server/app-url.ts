import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { env } from "@/lib/env";

const SETTING_KEY = "custom_domain";

const HOSTNAME_RE =
  /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Normalize user input ("https://x.com/", "X.COM") to a bare hostname, or null. */
export function normalizeDomain(input: string): string | null {
  let v = input.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  return HOSTNAME_RE.test(v) ? v : null;
}

/** The custom domain configured in Settings, or null. Cached per request.
 *  Degrades to null when the database is unreachable (e.g. during `next
 *  build`, where sitemap/robots prerendering has no DB) so callers fall back
 *  to the env APP_URL instead of failing. */
export const getCustomDomain = cache(async (): Promise<string | null> => {
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.name, SETTING_KEY))
      .limit(1);
    if (!row?.value) return null;
    const v = (row.value as Record<string, unknown>).domain;
    return typeof v === "string" && v.length > 0 ? v : null;
  } catch {
    return null;
  }
});

export async function setCustomDomain(domain: string | null): Promise<void> {
  const value = { domain: domain ?? "" };
  await db
    .insert(appSettings)
    .values({ name: SETTING_KEY, value })
    .onConflictDoUpdate({ target: appSettings.name, set: { value } });
}

/**
 * Canonical public base URL, no trailing slash. A custom domain saved in
 * Settings wins (always https — the bundled Caddy proxy terminates TLS for
 * it); otherwise the APP_URL env var from install time. Use this everywhere
 * a link leaves the app: emails, OAuth redirect URIs, copyable booking URLs.
 */
export const getAppUrl = cache(async (): Promise<string> => {
  const domain = await getCustomDomain();
  return domain ? `https://${domain}` : env.appUrl;
});
