import "server-only";
import type { EventLocation } from "@/db/schema";
import { dailyApp } from "./daily";
import { zoomApp } from "./zoom";
import type { VideoApp } from "./types";

/**
 * Conferencing resolution for a booking. Two flavours:
 *  - native: Google Meet / Teams links are minted by the calendar event itself,
 *    so we just tell the calendar layer which provider to request.
 *  - standalone: Zoom / Daily mint a link via their own API before the calendar
 *    event is written.
 */

export type NativeConference = "google_meet" | "office365_teams";

export interface ConferencingPlan {
  native?: NativeConference;
  standalone?: { slug: string; app: VideoApp };
}

const STANDALONE: Record<string, VideoApp | undefined> = {
  daily_video: dailyApp.video,
  zoom_video: zoomApp.video,
};

/** First location that implies conferencing wins. Returns null for non-video. */
export function resolveConferencing(locations: EventLocation[]): ConferencingPlan | null {
  for (const loc of locations) {
    switch (loc.type) {
      case "google_meet":
        return { native: "google_meet" };
      case "office365_video":
        return { native: "office365_teams" };
      case "zoom":
        return zoomApp.video ? { standalone: { slug: "zoom_video", app: zoomApp.video } } : null;
      case "daily_video":
        return dailyApp.video
          ? { standalone: { slug: "daily_video", app: dailyApp.video } }
          : null;
      default:
        continue;
    }
  }
  return null;
}

/** Tear down standalone meetings referenced by a booking (slug → VideoApp). */
export async function teardownStandaloneConference(
  userId: number,
  refType: string,
  meetingId: string,
): Promise<boolean> {
  const app = STANDALONE[refType];
  if (!app) return false;
  await app.deleteMeeting(userId, meetingId).catch(() => undefined);
  return true;
}

export function isStandaloneConferenceRef(refType: string): boolean {
  return refType in STANDALONE;
}

/**
 * Provision a meeting on the first standalone video app the user has connected
 * (Zoom, then Daily). Used for instant "meet now" links where there's no event
 * type to read a location from. Returns the app slug + meeting, or null.
 */
export async function provisionAnyVideoMeeting(input: {
  userId: number;
  topic: string;
  start: Date;
  end: Date;
  timeZone: string;
}): Promise<{ slug: string; meeting: { id: string; url: string; password?: string } } | null> {
  const candidates: { slug: string; app: typeof zoomApp }[] = [
    { slug: "zoom_video", app: zoomApp },
    { slug: "daily_video", app: dailyApp },
  ];
  for (const { slug, app } of candidates) {
    if (!app.video || !(await app.isConfigured().catch(() => false))) continue;
    if (!(await app.isInstalled(input.userId).catch(() => false))) continue;
    const meeting = await app.video.createMeeting(input).catch(() => null);
    if (meeting) return { slug, meeting };
  }
  return null;
}
