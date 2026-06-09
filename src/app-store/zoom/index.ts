import "server-only";
import { env } from "@/lib/env";
import { getZoomCreds } from "@/server/integration-credentials";
import type { AppDefinition, VideoApp } from "../types";
import { appMeta } from "../types";
import {
  hasAppCredential,
  loadAppCredential,
  markAppCredentialInvalid,
  saveAppCredential,
  updateAppCredential,
  deleteAppCredential,
} from "../credentials";

/**
 * Zoom video meetings via per-user OAuth (Authorization Code grant). Mirrors the
 * Microsoft adapter's token lifecycle: encrypted refresh tokens, transparent
 * refresh, mark-invalid on failure.
 */

const SLUG = "zoom_video";
const AUTH_BASE = "https://zoom.us/oauth";
const API = "https://api.zoom.us/v2";

interface ZoomTokens {
  access_token?: string;
  refresh_token?: string;
  /** epoch ms */
  expiry_date?: number;
}

function clientCreds(): Promise<{ clientId: string; clientSecret: string } | null> {
  return getZoomCreds();
}

async function isConfigured(): Promise<boolean> {
  return (await clientCreds()) !== null;
}

function redirectUri(): string {
  return `${env.appUrl}/api/apps/zoom_video/callback`;
}

async function getInstallUrl(state: string): Promise<string> {
  const creds = await clientCreds();
  if (!creds) throw new Error("Zoom is not configured");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.clientId,
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

/** Exchange an OAuth code for tokens and persist the credential. */
export async function exchangeZoomCode(code: string, userId: number): Promise<void> {
  const creds = await clientCreds();
  if (!creds) throw new Error("Zoom is not configured");
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(creds.clientId, creds.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`Zoom token exchange failed (${res.status})`);
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("Zoom returned no access token");
  const tokens: ZoomTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  await saveAppCredential(userId, SLUG, tokens);
}

async function getAccessToken(userId: number): Promise<string | null> {
  const cred = await loadAppCredential<ZoomTokens>(userId, SLUG);
  if (!cred) return null;
  const { id, data: tokens } = cred;

  if (tokens.access_token && tokens.expiry_date && tokens.expiry_date - 60_000 > Date.now()) {
    return tokens.access_token;
  }
  const creds = await clientCreds();
  if (!creds || !tokens.refresh_token) {
    await markAppCredentialInvalid(id);
    return null;
  }
  try {
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth(creds.clientId, creds.clientSecret)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
    });
    if (!res.ok) throw new Error(`refresh failed ${res.status}`);
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) throw new Error("no access token on refresh");
    const next: ZoomTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    await updateAppCredential(id, next);
    return next.access_token!;
  } catch {
    await markAppCredentialInvalid(id);
    return null;
  }
}

const zoomVideo: VideoApp = {
  async createMeeting(input) {
    const token = await getAccessToken(input.userId);
    if (!token) return null;
    try {
      const res = await fetch(`${API}/users/me/meetings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: input.topic,
          type: 2, // scheduled meeting
          start_time: input.start.toISOString(),
          duration: Math.max(1, Math.round((input.end.getTime() - input.start.getTime()) / 60000)),
          timezone: input.timeZone,
          agenda: input.description?.slice(0, 2000) ?? "",
          settings: { join_before_host: true, waiting_room: false },
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { id?: number; join_url?: string; password?: string };
      if (!data.id || !data.join_url) return null;
      return { id: String(data.id), url: data.join_url, password: data.password };
    } catch {
      return null;
    }
  },

  async deleteMeeting(userId, meetingId) {
    const token = await getAccessToken(userId);
    if (!token) return;
    await fetch(`${API}/meetings/${encodeURIComponent(meetingId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  },
};

export const zoomApp: AppDefinition = {
  meta: appMeta("zoom_video")!,
  isConfigured,
  isInstalled: (userId) => hasAppCredential(userId, SLUG),
  getInstallUrl,
  uninstall: (userId) => deleteAppCredential(userId, SLUG),
  video: zoomVideo,
};
