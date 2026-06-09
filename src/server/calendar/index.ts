import "server-only";
import { googleAdapter } from "./google";
import { microsoftAdapter } from "./microsoft";
import { caldavAdapter } from "./caldav";
import { invalidateCalendarCache, readBusyCache, writeBusyCache } from "./cache";
import type {
  BusyInterval,
  CalendarAdapter,
  CalendarIntegration,
  CreateCalendarEventInput,
} from "./types";

export type {
  BusyInterval,
  CalendarAdapter,
  CalendarIntegration,
  CalendarListEntry,
  CreateCalendarEventInput,
  CreatedCalendarEvent,
} from "./types";
export { invalidateCalendarCache } from "./cache";

/** All registered calendar providers, in display order. */
export const calendarAdapters: CalendarAdapter[] = [
  googleAdapter,
  microsoftAdapter,
  caldavAdapter,
];

export function getAdapter(integration: CalendarIntegration): CalendarAdapter | undefined {
  return calendarAdapters.find((a) => a.integration === integration);
}

/** The subset of providers the user currently has connected. */
export async function connectedAdapters(userId: number): Promise<CalendarAdapter[]> {
  const flags = await Promise.all(
    calendarAdapters.map((a) => a.isConnected(userId).catch(() => false)),
  );
  return calendarAdapters.filter((_, i) => flags[i]);
}

/**
 * Merge busy intervals from every connected calendar. Best-effort: a failing
 * provider contributes nothing rather than breaking availability.
 *
 * Read-through cached: the public booking page asks for the same window over and
 * over, and each miss is several network round-trips to Google/Microsoft/CalDAV.
 * The cache is busted whenever we mutate the user's calendar.
 */
export async function fetchBusyTimes(
  userId: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusyInterval[]> {
  const cached = await readBusyCache(userId, rangeStart, rangeEnd).catch(() => null);
  if (cached) return cached;

  const adapters = await connectedAdapters(userId);
  if (adapters.length === 0) return [];
  const results = await Promise.all(
    adapters.map((a) => a.fetchBusy(userId, rangeStart, rangeEnd).catch(() => [])),
  );
  const busy = results.flat();
  // Best-effort: never let a cache write failure break availability.
  await writeBusyCache(userId, rangeStart, rangeEnd, busy).catch(() => undefined);
  return busy;
}

export interface CreatedCalendarRef {
  integration: CalendarIntegration;
  eventId: string;
  calendarId: string;
  meetingUrl?: string;
}

/**
 * Create the event on every connected calendar. Returns one ref per provider
 * that succeeded so the caller can persist booking_references for later cleanup.
 */
export async function createCalendarEvents(
  userId: number,
  input: CreateCalendarEventInput,
): Promise<CreatedCalendarRef[]> {
  const adapters = await connectedAdapters(userId);
  const results = await Promise.all(
    adapters.map(async (a) => {
      try {
        // Only ask the calendar that matches the requested conferencing provider
        // for a native link, so a Meet booking never also mints a Teams meeting.
        const wantsNativeLink =
          (input.conferenceProvider === "google_meet" && a.integration === "google_calendar") ||
          (input.conferenceProvider === "office365_teams" &&
            a.integration === "office365_calendar");
        const created = await a.createEvent(userId, {
          ...input,
          requestConferenceLink: wantsNativeLink,
        });
        if (!created) return null;
        return { integration: a.integration, ...created };
      } catch {
        return null;
      }
    }),
  );
  // We just wrote to the user's calendars — their cached busy-times are stale.
  await invalidateCalendarCache(userId).catch(() => undefined);
  return results.filter((r): r is CreatedCalendarRef => r !== null);
}

export interface CalendarRef {
  integration: string;
  /** provider event id / object URL (booking_references.uid) */
  eventId: string;
  externalCalendarId: string | null;
}

/**
 * Update a set of existing external events in place (true two-way sync). Returns
 * one boolean per ref in order — `true` when that provider updated the event
 * without changing its identity (preserving the event + any conferencing link),
 * `false` when it couldn't, so the caller can fall back to delete + recreate.
 */
export async function updateCalendarEvents(
  userId: number,
  refs: CalendarRef[],
  input: Partial<CreateCalendarEventInput>,
): Promise<boolean[]> {
  const results = await Promise.all(
    refs.map(async (ref) => {
      const adapter = getAdapter(ref.integration as CalendarIntegration);
      if (!adapter) return false;
      return adapter
        .updateEvent(userId, ref.eventId, input, ref.externalCalendarId)
        .catch(() => false);
    }),
  );
  // The events moved — cached busy-times are stale.
  await invalidateCalendarCache(userId).catch(() => undefined);
  return results;
}

/** Delete a single external event identified by its stored reference. */
export async function deleteCalendarEvent(
  userId: number,
  integration: string,
  eventId: string,
  calendarId?: string | null,
): Promise<boolean> {
  const adapter = getAdapter(integration as CalendarIntegration);
  if (!adapter) return false;
  const ok = await adapter.deleteEvent(userId, eventId, calendarId).catch(() => false);
  await invalidateCalendarCache(userId).catch(() => undefined);
  return ok;
}

/** Connection status for every provider — drives the integrations UI. */
export async function listCalendarConnections(
  userId: number,
): Promise<{ integration: CalendarIntegration; label: string; connected: boolean }[]> {
  return Promise.all(
    calendarAdapters.map(async (a) => ({
      integration: a.integration,
      label: a.label,
      connected: await a.isConnected(userId).catch(() => false),
    })),
  );
}
