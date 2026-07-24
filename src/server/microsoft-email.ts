import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createTransport } from "nodemailer";
import { hmacSign, randomToken, deriveKey } from "@/lib/crypto";
import { getAppUrl } from "@/server/app-url";
import {
  deleteMicrosoftEmailConnection,
  getEmailProvider,
  getMicrosoftEmailConfig,
  getMicrosoftEmailConnection,
  setEmailProvider,
  setMicrosoftEmailConnection,
  type MicrosoftEmailConnection,
} from "@/server/settings";
import type { SendMailArgs } from "@/server/mailer";
import { IntegrationError } from "@/server/integration-error";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const SCOPES = "openid profile email offline_access User.Read Mail.Send";
const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_SKEW_MS = 5 * 60 * 1000;

interface MicrosoftTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface MicrosoftProfile {
  id?: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string;
}

function authority(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0`;
}

export interface MicrosoftOAuthRequest {
  url: string;
  state: string;
  codeVerifier: string;
}

export async function getMicrosoftCallbackUrl(): Promise<string> {
  return `${await getAppUrl()}/api/microsoft-email/callback`;
}

function stateSignature(payload: string): string {
  return hmacSign(`microsoft-email:${payload}`, deriveKey("microsoft-email-state"));
}

export function createMicrosoftOAuthState(
  adminUserId: number,
  issuedAt = Date.now(),
): string {
  const payload = `${adminUserId}.${issuedAt}.${randomToken(24)}`;
  return `${payload}.${stateSignature(payload)}`;
}

export function parseMicrosoftOAuthState(state: string): number | null {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [userIdRaw, issuedAtRaw, nonce, signature] = parts;
  const payload = `${userIdRaw}.${issuedAtRaw}.${nonce}`;
  const expected = stateSignature(payload);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  const userId = Number(userIdRaw);
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(issuedAt)) return null;
  if (issuedAt > Date.now() + 60_000 || Date.now() - issuedAt > STATE_TTL_MS) return null;
  return userId;
}

export async function createMicrosoftOAuthRequest(
  adminUserId: number,
): Promise<MicrosoftOAuthRequest> {
  const config = await getMicrosoftEmailConfig();
  if (!config?.clientId || !config.clientSecret) {
    throw new IntegrationError("Save the Microsoft Application Client ID and Client Secret first");
  }

  const state = createMicrosoftOAuthState(adminUserId);
  const codeVerifier = randomToken(48);
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: await getMicrosoftCallbackUrl(),
    response_mode: "query",
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return {
    url: `${authority(config.tenantId)}/authorize?${params.toString()}`,
    state,
    codeVerifier,
  };
}

async function tokenRequest(
  tenantId: string,
  params: URLSearchParams,
): Promise<MicrosoftTokenResponse> {
  const response = await fetch(`${authority(tenantId)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json() as MicrosoftTokenResponse;
  if (!response.ok || body.error) {
    throw new IntegrationError(
      body.error_description?.replace(/\s*Trace ID:.*$/s, "").trim() ||
        body.error ||
        "Microsoft rejected the OAuth request",
    );
  }
  return body;
}

function tenantIdFromIdToken(idToken?: string): string | undefined {
  if (!idToken) return undefined;
  try {
    const [, payload] = idToken.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      tid?: unknown;
    };
    return typeof decoded.tid === "string" ? decoded.tid : undefined;
  } catch {
    return undefined;
  }
}

async function fetchProfile(accessToken: string): Promise<MicrosoftProfile> {
  const response = await fetch(
    `${GRAPH_ROOT}/me?$select=id,displayName,mail,userPrincipalName`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new IntegrationError("Microsoft connected, but the mailbox profile could not be read");
  return response.json() as Promise<MicrosoftProfile>;
}

/** Exchange the one-time callback code and persist only encrypted credentials. */
export async function exchangeMicrosoftCode(
  code: string,
  codeVerifier: string,
): Promise<MicrosoftEmailConnection> {
  const config = await getMicrosoftEmailConfig();
  if (!config) throw new IntegrationError("Microsoft email application settings are missing");

  const tokens = await tokenRequest(config.tenantId, new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: await getMicrosoftCallbackUrl(),
    code_verifier: codeVerifier,
    scope: SCOPES,
  }));
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new IntegrationError("Microsoft did not return the offline access required for email sending");
  }

  const profile = await fetchProfile(tokens.access_token);
  const email = profile.mail || profile.userPrincipalName;
  if (!profile.id || !email) throw new IntegrationError("The connected Microsoft account has no mailbox address");
  const tokenTenantId = tenantIdFromIdToken(tokens.id_token);
  if (tokenTenantId && tokenTenantId.toLowerCase() !== config.tenantId.toLowerCase()) {
    throw new IntegrationError("Microsoft returned an account from a different directory");
  }

  const connection: MicrosoftEmailConnection = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000,
    scope: tokens.scope ?? SCOPES,
    account: {
      id: profile.id,
      email,
      name: profile.displayName || email,
      tenantId: tokenTenantId ?? config.tenantId,
    },
  };
  await setMicrosoftEmailConnection(connection);
  return connection;
}

async function refreshMicrosoftConnection(
  connection: MicrosoftEmailConnection,
): Promise<MicrosoftEmailConnection> {
  const config = await getMicrosoftEmailConfig();
  if (!config) throw new IntegrationError("Microsoft email application settings are missing");

  try {
    const tokens = await tokenRequest(config.tenantId, new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
      scope: SCOPES,
    }));
    if (!tokens.access_token) throw new IntegrationError("Microsoft returned no access token");

    const next: MicrosoftEmailConnection = {
      ...connection,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || connection.refreshToken,
      expiresAt: Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000,
      scope: tokens.scope ?? connection.scope,
    };
    await setMicrosoftEmailConnection(next);
    return next;
  } catch (error) {
    // A rejected refresh token requires an administrator to reconnect. Remove
    // it so the UI never claims a dead Microsoft connection is healthy.
    await deleteMicrosoftEmailConnection();
    if (await getEmailProvider() === "microsoft365") {
      await setEmailProvider("smtp");
    }
    throw error;
  }
}

export async function getValidMicrosoftConnection(): Promise<MicrosoftEmailConnection> {
  const connection = await getMicrosoftEmailConnection();
  if (!connection) throw new IntegrationError("Microsoft 365 email is not connected");
  if (connection.expiresAt - Date.now() <= REFRESH_SKEW_MS) {
    return refreshMicrosoftConnection(connection);
  }
  return connection;
}

export async function renderMicrosoftMime(
  args: SendMailArgs,
  from: string,
): Promise<Buffer> {
  const transport = createTransport({
    streamTransport: true,
    buffer: true,
    newline: "windows",
  });
  const info = await transport.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    icalEvent: args.icalEvent,
    attachments: args.attachments,
  });
  const message = (info as { message?: unknown }).message;
  if (!Buffer.isBuffer(message)) throw new IntegrationError("Unable to generate the Microsoft email message");
  return message;
}

async function graphSend(
  connection: MicrosoftEmailConnection,
  mime: Buffer,
): Promise<Response> {
  return fetch(`${GRAPH_ROOT}/me/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "text/plain",
    },
    body: mime.toString("base64"),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
}

export async function sendMicrosoftMail(args: SendMailArgs): Promise<void> {
  const config = await getMicrosoftEmailConfig();
  if (!config) throw new IntegrationError("Microsoft 365 email application settings are missing");

  let connection = await getValidMicrosoftConnection();
  const safeName = config.fromName.replace(/[\r\n"]/g, "").trim();
  const mime = await renderMicrosoftMime(
    args,
    safeName ? `"${safeName}" <${connection.account.email}>` : connection.account.email,
  );

  let response = await graphSend(connection, mime);
  if (response.status === 401) {
    connection = await refreshMicrosoftConnection(connection);
    response = await graphSend(connection, mime);
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new IntegrationError(`Microsoft Graph rejected the email (${response.status})${detail ? `: ${detail}` : ""}`);
  }
}

export async function disconnectMicrosoftEmail(): Promise<void> {
  await deleteMicrosoftEmailConnection();
}
