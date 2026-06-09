import "server-only";
import { getDailyCreds } from "@/server/integration-credentials";
import type { AppDefinition, VideoApp } from "../types";
import { appMeta } from "../types";

/**
 * Daily.co video rooms. Account-level API key (one key for the whole instance),
 * so there's no per-user OAuth — when a Daily API key is configured (Settings →
 * Integrations or DAILY_API_KEY) the provider is available to everyone.
 */

const API = "https://api.daily.co/v1";

async function apiKey(): Promise<string | null> {
  return (await getDailyCreds())?.apiKey ?? null;
}

async function isConfigured(): Promise<boolean> {
  return (await apiKey()) !== null;
}

async function daily(path: string, init?: RequestInit): Promise<Response | null> {
  const key = await apiKey();
  if (!key) return null;
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return null;
  }
}

const dailyVideo: VideoApp = {
  async createMeeting(input) {
    // Auto-expire the room two hours after the meeting ends so we never leak rooms.
    const exp = Math.floor(input.end.getTime() / 1000) + 2 * 60 * 60;
    const res = await daily("/rooms", {
      method: "POST",
      body: JSON.stringify({
        privacy: "public",
        properties: {
          exp,
          enable_prejoin_ui: true,
          enable_knocking: true,
          start_audio_off: false,
        },
      }),
    });
    if (!res || !res.ok) return null;
    const data = (await res.json()) as { name?: string; url?: string };
    if (!data.name || !data.url) return null;
    return { id: data.name, url: data.url };
  },

  async deleteMeeting(_userId, meetingId) {
    await daily(`/rooms/${encodeURIComponent(meetingId)}`, { method: "DELETE" });
  },
};

export const dailyApp: AppDefinition = {
  meta: appMeta("daily_video")!,
  isConfigured,
  // Account-level: if the instance is configured, the provider is usable by all.
  isInstalled: () => isConfigured(),
  video: dailyVideo,
};
