import type { EventLocation } from "@/db/schema";

/** Default Jitsi instance for the built-in, connection-free video option. */
const JITSI_BASE_URL = "https://meet.jit.si";

/**
 * Build a Jitsi room URL for a booking. The room id (a booking uid) is unique
 * and unguessable, giving every meeting its own private room with no API,
 * OAuth or provider connection — the always-available video fallback.
 */
export function jitsiRoomUrl(roomId: string): string {
  return `${JITSI_BASE_URL}/Tidetime-${roomId}`;
}

const VIDEO_TYPES = new Set<EventLocation["type"]>(["jitsi", "google_meet"]);

export function isVideoLocationType(type: EventLocation["type"]): boolean {
  return VIDEO_TYPES.has(type);
}

export function locationLabel(loc: EventLocation): string {
  switch (loc.type) {
    case "jitsi":
      return "Jitsi Meet";
    case "google_meet":
      return "Google Meet";
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

/**
 * Resolve the concrete meeting location string + URL stored on a booking at
 * creation time. Jitsi is generated immediately; Google Meet is provisioned by
 * the calendar integration after the booking is accepted.
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
      return { location: "Video call", meetingUrl: null };
    default:
      return { location: "Online", meetingUrl: null };
  }
}
