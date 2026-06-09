import type { EventLocation } from "@/db/schema";
import { MapPin, Phone, Video, Link2, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const LOCATION_OPTIONS: { type: EventLocation["type"]; label: string; icon: LucideIcon }[] = [
  { type: "in_person", label: "In person", icon: MapPin },
  { type: "phone", label: "Phone call (you call)", icon: Phone },
  { type: "attendee_phone", label: "Phone call (attendee provides number)", icon: Smartphone },
  { type: "link", label: "Custom link", icon: Link2 },
];

/** Video providers backed by the App Store. Shown only when connected. */
export const VIDEO_LOCATION_OPTIONS: {
  type: EventLocation["type"];
  label: string;
  icon: LucideIcon;
}[] = [
  { type: "jitsi", label: "Jitsi Meet (built-in)", icon: Video },
  { type: "google_meet", label: "Google Meet", icon: Video },
  { type: "office365_video", label: "Microsoft Teams", icon: Video },
  { type: "zoom", label: "Zoom", icon: Video },
  { type: "daily_video", label: "Daily video", icon: Video },
];

/** Default Jitsi instance for the built-in, connection-free video option. */
export const JITSI_BASE_URL = "https://meet.jit.si";

/**
 * Build a Jitsi room URL for a booking. The room id (a booking uid) is unique
 * and unguessable, giving every meeting its own private room with no API,
 * OAuth or provider connection — the always-available video fallback.
 */
export function jitsiRoomUrl(roomId: string): string {
  return `${JITSI_BASE_URL}/Tidetime-${roomId}`;
}

const VIDEO_TYPES = new Set<EventLocation["type"]>(
  VIDEO_LOCATION_OPTIONS.map((o) => o.type),
);

export function isVideoLocationType(type: EventLocation["type"]): boolean {
  return VIDEO_TYPES.has(type);
}

export function locationOption(type: EventLocation["type"]) {
  return [...LOCATION_OPTIONS, ...VIDEO_LOCATION_OPTIONS].find((o) => o.type === type);
}

export function locationLabel(loc: EventLocation): string {
  switch (loc.type) {
    case "jitsi":
      return "Jitsi Meet";
    case "google_meet":
      return "Google Meet";
    case "office365_video":
      return "Microsoft Teams";
    case "zoom":
      return "Zoom";
    case "daily_video":
      return "Video call";
    case "in_person":
      return loc.address ? `In person · ${loc.address}` : "In person";
    case "phone":
      return loc.phone ? `Phone · ${loc.phone}` : "Phone call";
    case "attendee_phone":
      return "Phone (attendee number)";
    case "link":
      return "Online";
    default:
      return "Online";
  }
}

export function locationIcon(type: EventLocation["type"]): LucideIcon {
  return locationOption(type)?.icon ?? Video;
}

/**
 * Resolve the concrete meeting location string + URL stored on a booking at
 * creation time. For App Store video providers the join URL is provisioned
 * asynchronously by booking-effects, so we record "Video call" with no URL yet.
 * Jitsi is the exception: its room is a pure function of the booking id, so the
 * link is minted here immediately — no provider, no API, no async step.
 */
export function resolveLocation(
  loc: EventLocation | undefined,
  attendeePhone?: string,
  roomId?: string,
): { location: string; meetingUrl: string | null } {
  if (!loc) return { location: "Online", meetingUrl: null };
  switch (loc.type) {
    case "in_person":
      return { location: loc.address || "In person", meetingUrl: null };
    case "phone":
      return { location: loc.phone ? `Call: ${loc.phone}` : "Phone call", meetingUrl: null };
    case "attendee_phone":
      return { location: attendeePhone ? `Call: ${attendeePhone}` : "Phone call", meetingUrl: null };
    case "link":
      return { location: "Online", meetingUrl: loc.link };
    case "jitsi":
      return { location: "Video call", meetingUrl: roomId ? jitsiRoomUrl(roomId) : null };
    case "google_meet":
    case "office365_video":
    case "zoom":
    case "daily_video":
      return { location: "Video call", meetingUrl: null };
    default:
      return { location: "Online", meetingUrl: null };
  }
}
