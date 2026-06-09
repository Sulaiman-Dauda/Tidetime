import "server-only";

/**
 * Provider-agnostic calendar contract. Every external calendar (Google,
 * Microsoft 365 / Outlook, Apple iCloud / CalDAV) implements this interface so
 * the rest of the app never has to special-case a provider.
 *
 * The persistence layer is already provider-neutral: `credentials.type`,
 * `selected_calendars.integration`, `destination_calendars.integration` and
 * `booking_references.type` all carry the integration key below.
 */

/** Stable integration keys. Used as credential `type` + calendar `integration`. */
export type CalendarIntegration =
  | "google_calendar"
  | "office365_calendar"
  | "caldav_calendar";

export interface BusyInterval {
  start: string;
  end: string;
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  primary: boolean;
}

export interface CreateCalendarEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  timeZone: string;
  attendees?: { email: string; name: string }[];
  /** request a provider-native conferencing link (Meet / Teams) */
  requestConferenceLink?: boolean;
  /**
   * Which native conferencing provider the booking wants. createCalendarEvents
   * uses this to ask ONLY the matching calendar for a link (so a Meet booking
   * doesn't also spawn a Teams meeting on a connected Outlook calendar).
   */
  conferenceProvider?: "google_meet" | "office365_teams";
  /**
   * Stable iCalendar UID for the meeting (derived from the booking's reschedule
   * root). Carried so providers that own their .ics (CalDAV) write — and later
   * UPDATE — the same UID the attendee's email invite uses, keeping a reschedule
   * an in-place update instead of a duplicate.
   */
  icalUid?: string;
  /** Monotonic iCalendar SEQUENCE; bumped on every reschedule/move. */
  sequence?: number;
}

export interface CreatedCalendarEvent {
  eventId: string;
  calendarId: string;
  meetingUrl?: string;
}

/**
 * One external calendar provider. Implementations are best-effort: read paths
 * return empty results on failure and write paths return null/false so a single
 * flaky provider never blocks a booking or hides availability from others.
 */
export interface CalendarAdapter {
  readonly integration: CalendarIntegration;
  /** human label for UIs/badges */
  readonly label: string;
  isConnected(userId: number): Promise<boolean>;
  listCalendars(userId: number): Promise<CalendarListEntry[]>;
  fetchBusy(userId: number, rangeStart: Date, rangeEnd: Date): Promise<BusyInterval[]>;
  createEvent(
    userId: number,
    input: CreateCalendarEventInput,
  ): Promise<CreatedCalendarEvent | null>;
  updateEvent(
    userId: number,
    eventId: string,
    input: Partial<CreateCalendarEventInput>,
    calendarId?: string | null,
  ): Promise<boolean>;
  deleteEvent(
    userId: number,
    eventId: string,
    calendarId?: string | null,
  ): Promise<boolean>;
  disconnect(userId: number): Promise<void>;
}
