import "server-only";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  disconnectGoogleCalendar,
  fetchGoogleBusyTime,
  isGoogleConnected,
  listGoogleCalendars,
  updateGoogleCalendarEvent,
} from "../google-calendar";
import type { CalendarAdapter } from "./types";

/**
 * Google Calendar as a CalendarAdapter. Thin wrapper over the existing
 * google-calendar module (which the OAuth routes still use directly).
 */
export const googleAdapter: CalendarAdapter = {
  integration: "google_calendar",
  label: "Google Calendar",
  isConnected: (userId) => isGoogleConnected(userId),
  listCalendars: (userId) => listGoogleCalendars(userId),
  fetchBusy: (userId, start, end) => fetchGoogleBusyTime(userId, start, end),
  createEvent: (userId, input) =>
    createGoogleCalendarEvent(userId, {
      summary: input.summary,
      description: input.description,
      start: input.start,
      end: input.end,
      location: input.location,
      timeZone: input.timeZone,
      attendees: input.attendees,
      // presence of meetingUrl triggers a Google Meet conference request
      meetingUrl: input.requestConferenceLink ? "auto" : undefined,
    }),
  updateEvent: (userId, eventId, input, calendarId) =>
    updateGoogleCalendarEvent(
      userId,
      eventId,
      {
        summary: input.summary,
        description: input.description,
        start: input.start,
        end: input.end,
        location: input.location,
        timeZone: input.timeZone,
      },
      calendarId,
    ),
  deleteEvent: (userId, eventId, calendarId) =>
    deleteGoogleCalendarEvent(userId, eventId, calendarId),
  disconnect: (userId) => disconnectGoogleCalendar(userId),
};
