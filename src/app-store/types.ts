import type { EventLocation } from "@/db/schema";

/**
 * Tidetime App Store — a self-contained, registry-driven integration system
 * modelled on Cal.com's app-store. Each app lives in its own folder under
 * `src/app-store/<slug>/` and exports an {@link AppDefinition}. The rest of the
 * app never special-cases a provider: it asks the registry.
 *
 * This module is intentionally free of `server-only` so the plain metadata
 * ({@link APP_META}) can be imported by client components (e.g. the location
 * picker) while the behavioural pieces in `<slug>/index.ts` stay server-side.
 */

export type AppCategory = "calendar" | "video" | "crm" | "automation" | "payment";

export interface AppMeta {
  /** stable id; also the `credentials.type` for OAuth apps and booking_reference type */
  slug: string;
  name: string;
  category: AppCategory;
  /** short one-liner shown on the connection card */
  description: string;
  publisher: string;
  /** the EventLocation type this app backs, for video apps */
  locationType?: EventLocation["type"];
  /** lucide-react icon name, resolved in the UI */
  icon: string;
  docsUrl?: string;
}

/* -------------------------------------------------------------------------- */
/*  Behavioural contracts                                                      */
/* -------------------------------------------------------------------------- */

export interface VideoMeetingInput {
  userId: number;
  topic: string;
  description?: string;
  start: Date;
  end: Date;
  timeZone: string;
}

export interface VideoMeeting {
  /** provider meeting id, used for later teardown */
  id: string;
  url: string;
  password?: string;
}

/**
 * A standalone video provider that mints its own meeting (Zoom, Daily). Native
 * conferencing baked into a calendar event (Google Meet, Teams) does NOT
 * implement this — those links come back from the calendar event itself.
 */
export interface VideoApp {
  createMeeting(input: VideoMeetingInput): Promise<VideoMeeting | null>;
  deleteMeeting(userId: number, meetingId: string): Promise<void>;
}

export interface CrmContact {
  email: string;
  name?: string;
  phone?: string;
}

export interface CrmBookingEvent {
  contact: CrmContact;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  meetingUrl?: string | null;
}

/** A CRM that records booking activity (HubSpot, …). Best-effort, never blocks. */
export interface CrmApp {
  onBookingCreated(userId: number, event: CrmBookingEvent): Promise<void>;
}

export interface AppDefinition {
  meta: AppMeta;
  /** credentials present (DB or env)? when false the app is shown as "needs setup" */
  isConfigured(): Promise<boolean>;
  /** is the app connected/active for this user? */
  isInstalled(userId: number): Promise<boolean>;
  /** OAuth consent URL; omit for non-OAuth apps (global API key) */
  getInstallUrl?(state: string): Promise<string>;
  /** remove the app for a user */
  uninstall?(userId: number): Promise<void>;
  video?: VideoApp;
  crm?: CrmApp;
}

/* -------------------------------------------------------------------------- */
/*  Client-safe metadata (no behaviour, no server-only deps)                   */
/* -------------------------------------------------------------------------- */

export const APP_META: AppMeta[] = [
  {
    slug: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    description: "Two-way sync: read busy times and write booking events.",
    publisher: "Google",
    icon: "Calendar",
  },
  {
    slug: "office365_calendar",
    name: "Microsoft 365 / Outlook",
    category: "calendar",
    description: "Two-way sync with Outlook calendars via Microsoft Graph.",
    publisher: "Microsoft",
    icon: "Calendar",
  },
  {
    slug: "caldav_calendar",
    name: "CalDAV",
    category: "calendar",
    description: "Connect any CalDAV server (Apple iCloud, Fastmail, Nextcloud).",
    publisher: "CalDAV",
    icon: "Calendar",
  },
  {
    slug: "daily_video",
    name: "Daily",
    category: "video",
    description: "Auto-create a Daily video room for every booking.",
    publisher: "Daily.co",
    locationType: "daily_video",
    icon: "Video",
    docsUrl: "https://docs.daily.co/reference/rest-api",
  },
  {
    slug: "zoom_video",
    name: "Zoom",
    category: "video",
    description: "Generate a Zoom meeting link automatically per booking.",
    publisher: "Zoom",
    locationType: "zoom",
    icon: "Video",
    docsUrl: "https://developers.zoom.us",
  },
  {
    slug: "office365_video",
    name: "Microsoft Teams",
    category: "video",
    description: "Attach a Teams meeting to bookings (uses your Outlook connection).",
    publisher: "Microsoft",
    locationType: "office365_video",
    icon: "Video",
  },
  {
    slug: "hubspot",
    name: "HubSpot",
    category: "crm",
    description: "Log every booking as a HubSpot contact + meeting engagement.",
    publisher: "HubSpot",
    icon: "Users",
    docsUrl: "https://developers.hubspot.com",
  },
];

export function appMeta(slug: string): AppMeta | undefined {
  return APP_META.find((a) => a.slug === slug);
}

/** Video location types backed by an app-store app. */
export const VIDEO_LOCATION_TYPES = APP_META.filter((a) => a.category === "video").map(
  (a) => a.locationType,
) as EventLocation["type"][];
