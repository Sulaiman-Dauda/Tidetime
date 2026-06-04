import type { EventLocation } from "@/db/schema";
import { MapPin, Phone, Video, Link2, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const LOCATION_OPTIONS: { type: EventLocation["type"]; label: string; icon: LucideIcon }[] = [
  { type: "in_person", label: "In person", icon: MapPin },
  { type: "phone", label: "Phone call (you call)", icon: Phone },
  { type: "attendee_phone", label: "Phone call (attendee provides number)", icon: Smartphone },
  { type: "link", label: "Custom link", icon: Link2 },
];

export const LEGACY_LOCATION_OPTIONS: { type: EventLocation["type"]; label: string; icon: LucideIcon }[] = [
  { type: "google_meet", label: "Google Meet (not connected)", icon: Video },
  { type: "zoom", label: "Zoom (not connected)", icon: Video },
];

export function locationOption(type: EventLocation["type"]) {
  return [...LOCATION_OPTIONS, ...LEGACY_LOCATION_OPTIONS].find((o) => o.type === type);
}

export function isUnsupportedLocationType(type: EventLocation["type"]): boolean {
  return type === "google_meet" || type === "zoom";
}

export function locationLabel(loc: EventLocation): string {
  switch (loc.type) {
    case "google_meet":
    case "zoom":
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
 * Resolve the concrete meeting location string + URL stored on a booking.
 * Managed video providers are not connected yet, so they fall back to an
 * honest manual hand-off message instead of implying a join link exists.
 */
export function resolveLocation(
  loc: EventLocation | undefined,
  attendeePhone?: string,
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
    case "google_meet":
    case "zoom":
      return { location: "Video call details will be shared separately", meetingUrl: null };
    default:
      return { location: "Online", meetingUrl: null };
  }
}
