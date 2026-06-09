import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";

/**
 * Resolves integration provider credentials (OAuth client id/secret, Daily API
 * key) **DB-first, with env fallback** — the same model the app already uses for
 * SMTP and Stripe. Operators can paste credentials in Settings → Integrations
 * (stored encrypted in `app_settings`) instead of editing env + redeploying.
 *
 * The DB blob for each provider is a single AES-GCM-encrypted JSON string, so
 * client secrets never sit in the database (or backups) in plaintext.
 */

const SETTING_KEY = "integration_credentials";

export type IntegrationProvider =
  | "google_calendar"
  | "office365_calendar"
  | "zoom_video"
  | "hubspot"
  | "daily_video";

export interface OAuthCreds {
  clientId: string;
  clientSecret: string;
}
export interface DailyCreds {
  apiKey: string;
  subdomain?: string;
}

/** OAuth providers configured with a client id + secret. */
const OAUTH_PROVIDERS = {
  google_calendar: { idEnv: "GOOGLE_CLIENT_ID", secretEnv: "GOOGLE_CLIENT_SECRET" },
  office365_calendar: { idEnv: "MICROSOFT_CLIENT_ID", secretEnv: "MICROSOFT_CLIENT_SECRET" },
  zoom_video: { idEnv: "ZOOM_CLIENT_ID", secretEnv: "ZOOM_CLIENT_SECRET" },
  hubspot: { idEnv: "HUBSPOT_CLIENT_ID", secretEnv: "HUBSPOT_CLIENT_SECRET" },
} as const;

type StoredBlob = Partial<Record<IntegrationProvider, string>>;

/** Raw encrypted blob map from app_settings, cached per request. */
const readBlob = cache(async (): Promise<StoredBlob> => {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, SETTING_KEY))
    .limit(1);
  if (!row?.value || typeof row.value !== "object") return {};
  return row.value as StoredBlob;
});

async function readStored<T>(provider: IntegrationProvider): Promise<T | null> {
  const blob = await readBlob();
  const enc = blob[provider];
  if (!enc) return null;
  try {
    return JSON.parse(decrypt(enc)) as T;
  } catch {
    return null;
  }
}

function oauthFromEnv(provider: keyof typeof OAUTH_PROVIDERS): OAuthCreds | null {
  const { idEnv, secretEnv } = OAUTH_PROVIDERS[provider];
  const clientId = process.env[idEnv]?.trim();
  const clientSecret = process.env[secretEnv]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function getOAuthCreds(provider: keyof typeof OAUTH_PROVIDERS): Promise<OAuthCreds | null> {
  const stored = await readStored<OAuthCreds>(provider);
  if (stored?.clientId && stored?.clientSecret) return stored;
  return oauthFromEnv(provider);
}

export const getGoogleCreds = () => getOAuthCreds("google_calendar");
export const getMicrosoftCreds = () => getOAuthCreds("office365_calendar");
export const getZoomCreds = () => getOAuthCreds("zoom_video");
export const getHubspotCreds = () => getOAuthCreds("hubspot");

export async function getDailyCreds(): Promise<DailyCreds | null> {
  const stored = await readStored<DailyCreds>("daily_video");
  if (stored?.apiKey) return stored;
  const apiKey = process.env.DAILY_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, subdomain: process.env.DAILY_SUBDOMAIN?.trim() || undefined };
}

/* -------------------------------------------------------------------------- */
/*  Admin writes                                                                */
/* -------------------------------------------------------------------------- */

async function writeBlob(next: StoredBlob): Promise<void> {
  await db
    .insert(appSettings)
    .values({ name: SETTING_KEY, value: next as Record<string, unknown> })
    .onConflictDoUpdate({ target: appSettings.name, set: { value: next as Record<string, unknown> } });
}

/**
 * Save (or clear) a provider's credentials. Passing an empty object clears the
 * DB entry so the env fallback (if any) takes over again. Reads the existing
 * blob directly (not the cached reader) to avoid a stale write.
 */
export async function setIntegrationCreds(
  provider: IntegrationProvider,
  creds: OAuthCreds | DailyCreds | null,
): Promise<void> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, SETTING_KEY))
    .limit(1);
  const blob: StoredBlob = row?.value && typeof row.value === "object" ? { ...(row.value as StoredBlob) } : {};

  const isEmpty =
    !creds ||
    ("clientId" in creds && !creds.clientId.trim()) ||
    ("apiKey" in creds && !creds.apiKey.trim());

  if (isEmpty) {
    delete blob[provider];
  } else {
    blob[provider] = encrypt(JSON.stringify(creds));
  }
  await writeBlob(blob);
}

/* -------------------------------------------------------------------------- */
/*  Status (for the admin UI)                                                   */
/* -------------------------------------------------------------------------- */

export type CredentialSource = "db" | "env" | "none";

export interface ProviderCredentialStatus {
  provider: IntegrationProvider;
  configured: boolean;
  source: CredentialSource;
  /** non-secret hint so the UI can show "•••• set" without leaking secrets */
  clientIdMasked?: string;
}

function mask(value: string): string {
  if (value.length <= 6) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-2)}`;
}

export async function getCredentialStatuses(): Promise<
  Record<IntegrationProvider, ProviderCredentialStatus>
> {
  const blob = await readBlob();
  const out = {} as Record<IntegrationProvider, ProviderCredentialStatus>;

  for (const provider of Object.keys(OAUTH_PROVIDERS) as (keyof typeof OAUTH_PROVIDERS)[]) {
    const stored = await readStored<OAuthCreds>(provider);
    if (stored?.clientId && stored?.clientSecret) {
      out[provider] = { provider, configured: true, source: "db", clientIdMasked: mask(stored.clientId) };
    } else {
      const env = oauthFromEnv(provider);
      out[provider] = env
        ? { provider, configured: true, source: "env", clientIdMasked: mask(env.clientId) }
        : { provider, configured: false, source: "none" };
    }
  }

  // Daily (API key)
  const dailyStored = blob.daily_video ? await readStored<DailyCreds>("daily_video") : null;
  if (dailyStored?.apiKey) {
    out.daily_video = { provider: "daily_video", configured: true, source: "db", clientIdMasked: mask(dailyStored.apiKey) };
  } else {
    const envKey = process.env.DAILY_API_KEY?.trim();
    out.daily_video = envKey
      ? { provider: "daily_video", configured: true, source: "env", clientIdMasked: mask(envKey) }
      : { provider: "daily_video", configured: false, source: "none" };
  }

  return out;
}
