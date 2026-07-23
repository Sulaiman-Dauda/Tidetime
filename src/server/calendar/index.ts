import "server-only";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  fetchGoogleBusyTime,
  isGoogleConnected,
  updateGoogleCalendarEvent,
  type BusyInterval,
} from "../google-calendar";
import { invalidateCalendarCache, readBusyCache, writeBusyCache } from "./cache";

export type { BusyInterval };

export interface CreateCalendarEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  timeZone: string;
  attendees?: { email: string; name: string }[];
  conferenceProvider?: "google_meet";
  icalUid?: string;
  sequence?: number;
}

export interface CreatedCalendarRef {
  eventId: string;
  calendarId: string;
  meetingUrl?: string;
}

/** Fetch Google busy-times with a short read-through cache. */
export async function fetchBusyTimes(
  userId: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusyInterval[]> {
  const cached = await readBusyCache(userId, rangeStart, rangeEnd).catch(() => null);
  if (cached) return cached;
  if (!(await isGoogleConnected(userId).catch(() => false))) return [];

  const busy = await fetchGoogleBusyTime(userId, rangeStart, rangeEnd).catch(() => []);
  await writeBusyCache(userId, rangeStart, rangeEnd, busy).catch(() => undefined);
  return busy;
}

/** Create the booking's Google Calendar event when the provider is connected. */
export async function createCalendarEvents(
  userId: number,
  input: CreateCalendarEventInput,
): Promise<CreatedCalendarRef[]> {
  if (!(await isGoogleConnected(userId).catch(() => false))) return [];
  const created = await createGoogleCalendarEvent(userId, {
    summary: input.summary,
    description: input.description,
    start: input.start,
    end: input.end,
    location: input.location,
    timeZone: input.timeZone,
    attendees: input.attendees,
    meetingUrl: input.conferenceProvider === "google_meet" ? "auto" : undefined,
  }).catch(() => null);
  await invalidateCalendarCache(userId).catch(() => undefined);
  return created ? [created] : [];
}

export async function updateCalendarEvents(
  userId: number,
  refs: { eventId: string; calendarId: string | null }[],
  input: Partial<CreateCalendarEventInput>,
): Promise<boolean[]> {
  const results = await Promise.all(
    refs.map((ref) =>
      updateGoogleCalendarEvent(userId, ref.eventId, input, ref.calendarId).catch(() => false),
    ),
  );
  await invalidateCalendarCache(userId).catch(() => undefined);
  return results;
}

export async function deleteCalendarEvent(
  userId: number,
  eventId: string,
  calendarId?: string | null,
): Promise<boolean> {
  const deleted = await deleteGoogleCalendarEvent(userId, eventId, calendarId).catch(() => false);
  await invalidateCalendarCache(userId).catch(() => undefined);
  return deleted;
}
