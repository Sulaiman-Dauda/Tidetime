import type { EventLocation } from "@/db/schema";
import { MapPin, Phone, Video, Link2, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const LOCATION_OPTIONS: { type: EventLocation["type"]; label: string; icon: LucideIcon }[] = [
  { type: "google_meet", label: "Google Meet", icon: Video },
  { type: "zoom", label: "Zoom", icon: Video },
  { type: "in_person", label: "In person", icon: MapPin },
  { type: "phone", label: "Phone call (you call)", icon: Phone },
  { type: "attendee_phone", label: "Phone call (attendee provides number)", icon: Smartphone },
  { type: "link", label: "Custom link", icon: Link2 },
];

export function locationLabel(loc: EventLocation): string {
  switch (loc.type) {
    case "google_meet":
      return "Google Meet";
    case "zoom":
      return "Zoom";
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
  return LOCATION_OPTIONS.find((o) => o.type === type)?.icon ?? Video;
}

/**
 * Resolve the concrete meeting location string + URL stored on a booking.
 * Video integrations produce a placeholder link until calendar/video sync runs.
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
      return { location: "Google Meet", meetingUrl: null };
    case "zoom":
      return { location: "Zoom", meetingUrl: null };
    default:
      return { location: "Online", meetingUrl: null };
  }
}
