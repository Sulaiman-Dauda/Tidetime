import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { credentials } from "@/db/schema";
import { encrypt, decrypt, randomToken } from "@/lib/crypto";
import { getAppUrl } from "@/server/app-url";
import { getMicrosoftEmailConfig } from "@/server/settings";
import type { BusyInterval } from "@/server/google-calendar";
import { IntegrationError } from "@/server/integration-error";

/**
 * Per-user Microsoft 365 calendar connection for busy-time conflict checking.
 * Reuses the company's Entra app registration (the one configured for email)
 * with delegated, read-only calendar consent. Booking events keep flowing to
 * Google/ICS — this connection only blocks conflicting public slots.
 */

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const SCOPES = "offline_access https://graph.microsoft.com/Calendars.Read";
const REFRESH_SKEW_MS = 5 * 60 * 1000;
const PROVIDER = "microsoft";

interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  /** epoch ms when access_token expires */
  expires_at: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

function authority(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0`;
}

export async function getMicrosoftCalendarCallbackUrl(): Promise<string> {
  return `${await getAppUrl()}/api/microsoft-calendar/callback`;
}

/** PKCE consent URL. State/verifier round-trip via httpOnly cookies. */
export async function createMicrosoftCalendarOAuthRequest(): Promise<{
  url: string;
  state: string;
  codeVerifier: string;
}> {
  const config = await getMicrosoftEmailConfig();
  if (!config) {
    throw new IntegrationError("Connect Microsoft 365 in company Settings first — the calendar uses the same app registration");
  }
  const state = randomToken(24);
  const codeVerifier = randomToken(48);
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: await getMicrosoftCalendarCallbackUrl(),
    response_mode: "query",
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `${authority(config.tenantId)}/authorize?${params.toString()}`, state, codeVerifier };
}

async function tokenRequest(tenantId: string, params: URLSearchParams): Promise<StoredTokens> {
  const response = await fetch(`${authority(tenantId)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json()) as TokenResponse;
  if (!response.ok || body.error || !body.access_token) {
    throw new IntegrationError(
      body.error_description?.replace(/\s*Trace ID:.*$/s, "").trim() ||
        body.error ||
        "Microsoft rejected the OAuth request",
    );
  }
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
  };
}

/** Exchange the callback code and persist the encrypted per-user credential. */
export async function exchangeMicrosoftCalendarCode(userId: number, code: string, codeVerifier: string): Promise<void> {
  const config = await getMicrosoftEmailConfig();
  if (!config) throw new IntegrationError("Microsoft application settings are missing");
  const tokens = await tokenRequest(config.tenantId, new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: await getMicrosoftCalendarCallbackUrl(),
    scope: SCOPES,
  }));

  await db.delete(credentials).where(and(eq(credentials.userId, userId), eq(credentials.provider, PROVIDER)));
  await db.insert(credentials).values({ userId, provider: PROVIDER, key: encrypt(JSON.stringify(tokens)) });
}

/** Valid access token for a user, refreshing (and rotating) when near expiry. */
async function getAccessToken(userId: number): Promise<string | null> {
  const [cred] = await db
    .select()
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.provider, PROVIDER), eq(credentials.invalid, false)))
    .limit(1);
  if (!cred) return null;

  let tokens: StoredTokens;
  try {
    tokens = JSON.parse(decrypt(cred.key)) as StoredTokens;
  } catch {
    await db.update(credentials).set({ invalid: true }).where(eq(credentials.id, cred.id));
    return null;
  }

  if (tokens.expires_at - REFRESH_SKEW_MS > Date.now()) return tokens.access_token;
  if (!tokens.refresh_token) {
    await db.update(credentials).set({ invalid: true }).where(eq(credentials.id, cred.id));
    return null;
  }

  const config = await getMicrosoftEmailConfig();
  if (!config) return null;
  try {
    const refreshed = await tokenRequest(config.tenantId, new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      scope: SCOPES,
    }));
    const next: StoredTokens = {
      ...refreshed,
      refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
    };
    await db.update(credentials).set({ key: encrypt(JSON.stringify(next)) }).where(eq(credentials.id, cred.id));
    return next.access_token;
  } catch {
    await db.update(credentials).set({ invalid: true }).where(eq(credentials.id, cred.id));
    return null;
  }
}

export async function isMicrosoftCalendarConnected(userId: number): Promise<boolean> {
  if (!userId) return false;
  const [cred] = await db
    .select({ id: credentials.id })
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.provider, PROVIDER), eq(credentials.invalid, false)))
    .limit(1);
  return Boolean(cred);
}

export async function hasExpiredMicrosoftCalendarCredential(userId: number): Promise<boolean> {
  if (!userId) return false;
  const [cred] = await db
    .select({ id: credentials.id })
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.provider, PROVIDER), eq(credentials.invalid, true)))
    .limit(1);
  return Boolean(cred);
}

export async function disconnectMicrosoftCalendar(userId: number): Promise<void> {
  await db.delete(credentials).where(and(eq(credentials.userId, userId), eq(credentials.provider, PROVIDER)));
}

interface GraphEvent {
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  showAs?: string;
  isCancelled?: boolean;
}

/** Busy intervals from the user's Outlook calendar over a range. */
export async function fetchMicrosoftBusyTime(
  userId: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusyInterval[]> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) return [];

  const params = new URLSearchParams({
    startDateTime: rangeStart.toISOString(),
    endDateTime: rangeEnd.toISOString(),
    $select: "start,end,showAs,isCancelled",
    $top: "200",
  });
  const response = await fetch(`${GRAPH_ROOT}/me/calendarView?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { value?: GraphEvent[] };

  // Graph returns "2026-07-24T10:00:00.0000000" (no zone designator) when the
  // Prefer header pins UTC.
  const toIso = (raw: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`).toISOString();
  const busy: BusyInterval[] = [];
  for (const event of body.value ?? []) {
    if (event.isCancelled || event.showAs === "free") continue;
    if (!event.start?.dateTime || !event.end?.dateTime) continue;
    busy.push({ start: toIso(event.start.dateTime), end: toIso(event.end.dateTime) });
  }
  return busy;
}
