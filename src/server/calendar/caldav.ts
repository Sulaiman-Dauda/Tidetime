import "server-only";
import { eq, and } from "drizzle-orm";
import { createDAVClient, type DAVCalendar } from "tsdav";
import { db } from "@/db";
import { credentials } from "@/db/schema";
import { encrypt, decrypt, shortId } from "@/lib/crypto";
import { generateIcs, bookingIcalUid } from "@/lib/ics";
import { parseIcsBusy } from "@/lib/ical-busy";
import { assertPublicUrl } from "@/server/ssrf";
import type {
  CalendarAdapter,
  CalendarListEntry,
  BusyInterval,
  CreatedCalendarEvent,
} from "./types";
import {
  deleteIntegration,
  getDestinationCalendarId,
  getSelectedCalendarIds,
  hasCredential,
} from "./store";

type DavClient = Awaited<ReturnType<typeof createDAVClient>>;

/* -------------------------------------------------------------------------- */
/*  CalDAV (Apple iCloud, Fastmail, Nextcloud, …)                              */
/* -------------------------------------------------------------------------- */

const INTEGRATION = "caldav_calendar" as const;

interface CaldavCredential {
  serverUrl: string;
  username: string;
  password: string;
}

async function loadCredential(userId: number): Promise<{ id: number; data: CaldavCredential } | null> {
  const [cred] = await db
    .select()
    .from(credentials)
    .where(
      and(
        eq(credentials.userId, userId),
        eq(credentials.type, INTEGRATION),
        eq(credentials.invalid, false),
      ),
    )
    .limit(1);
  if (!cred) return null;
  return { id: cred.id, data: JSON.parse(decrypt(cred.key)) as CaldavCredential };
}

/** Pull the UID line out of an iCalendar object so an update reuses it. */
function extractIcsUid(ics: string): string | null {
  const m = ics.match(/^UID:(.+)$/m);
  return m ? m[1].trim() : null;
}

async function makeClient(data: CaldavCredential): Promise<DavClient> {
  // Re-validate the stored server URL on every client build, not just at connect
  // time — DNS can be re-pointed at an internal host after the credential is
  // saved (DNS-rebinding / TOCTOU). assertPublicUrl resolves + checks each call.
  await assertPublicUrl(data.serverUrl);
  return createDAVClient({
    serverUrl: data.serverUrl,
    credentials: { username: data.username, password: data.password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

async function getClient(userId: number): Promise<DavClient | null> {
  const cred = await loadCredential(userId);
  if (!cred) return null;
  try {
    return await makeClient(cred.data);
  } catch {
    return null;
  }
}

/**
 * Validate credentials by connecting + listing calendars, then persist them.
 * Throws on failure so the connect route can surface a useful error.
 */
export async function connectCaldav(
  userId: number,
  serverUrl: string,
  username: string,
  password: string,
): Promise<void> {
  const data: CaldavCredential = { serverUrl: serverUrl.trim(), username: username.trim(), password };
  // SSRF guard: reject private/loopback/link-local targets before we connect.
  await assertPublicUrl(data.serverUrl);
  const client = await makeClient(data);
  const calendars = await client.fetchCalendars();
  if (!Array.isArray(calendars)) throw new Error("No calendars returned");

  await db
    .delete(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.type, INTEGRATION)));
  await db
    .insert(credentials)
    .values({ userId, type: INTEGRATION, key: encrypt(JSON.stringify(data)) });
}

async function fetchCalendarsFor(userId: number): Promise<{ client: DavClient; calendars: DAVCalendar[] } | null> {
  const client = await getClient(userId);
  if (!client) return null;
  try {
    const calendars = await client.fetchCalendars();
    return { client, calendars };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Adapter                                                                     */
/* -------------------------------------------------------------------------- */

export const caldavAdapter: CalendarAdapter = {
  integration: INTEGRATION,
  label: "Apple / CalDAV",

  isConnected: (userId) => hasCredential(userId, INTEGRATION),

  async listCalendars(userId): Promise<CalendarListEntry[]> {
    const ctx = await fetchCalendarsFor(userId);
    if (!ctx) return [];
    return ctx.calendars
      .filter((c) => (c.components ?? ["VEVENT"]).includes("VEVENT"))
      .map((c) => ({
        id: c.url,
        summary: typeof c.displayName === "string" ? c.displayName : c.url,
        primary: false,
      }));
  },

  async fetchBusy(userId, rangeStart, rangeEnd): Promise<BusyInterval[]> {
    const ctx = await fetchCalendarsFor(userId);
    if (!ctx) return [];
    const selected = await getSelectedCalendarIds(userId, INTEGRATION);
    const targets =
      selected.length > 0
        ? ctx.calendars.filter((c) => selected.includes(c.url))
        : ctx.calendars.filter((c) => (c.components ?? ["VEVENT"]).includes("VEVENT"));

    const busy: BusyInterval[] = [];
    for (const calendar of targets) {
      try {
        const objects = await ctx.client.fetchCalendarObjects({
          calendar,
          timeRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
        });
        for (const obj of objects) {
          if (typeof obj.data === "string") busy.push(...parseIcsBusy(obj.data));
        }
      } catch {
        // skip a flaky calendar
      }
    }
    return busy;
  },

  async createEvent(userId, input): Promise<CreatedCalendarEvent | null> {
    const ctx = await fetchCalendarsFor(userId);
    if (!ctx) return null;
    const destination = await getDestinationCalendarId(userId, INTEGRATION);
    const calendar =
      ctx.calendars.find((c) => c.url === destination) ??
      ctx.calendars.find((c) => (c.components ?? ["VEVENT"]).includes("VEVENT"));
    if (!calendar) return null;

    const uid = `${shortId(8)}`;
    const iCalString = generateIcs({
      // Prefer the booking's stable UID so a later reschedule can UPDATE this
      // exact object in place; fall back to a per-object UID when none is given.
      uid: input.icalUid ?? bookingIcalUid(uid),
      start: input.start,
      end: input.end,
      summary: input.summary,
      description: input.description,
      location: input.location,
      attendees: input.attendees,
      status: "CONFIRMED",
      sequence: input.sequence,
    });
    const filename = `${uid}.ics`;
    try {
      const res = await ctx.client.createCalendarObject({
        calendar,
        filename,
        iCalString,
      });
      if (!res.ok) return null;
      const base = calendar.url.endsWith("/") ? calendar.url : `${calendar.url}/`;
      return { eventId: `${base}${filename}`, calendarId: calendar.url };
    } catch {
      return null;
    }
  },

  // In-place update: rewrite the existing .ics object at its URL, reusing the
  // stored UID and bumping SEQUENCE so the host's calendar (and any subscriber)
  // updates the event rather than leaving a stale copy behind.
  async updateEvent(userId, eventId, input, calendarId): Promise<boolean> {
    if (!input.start || !input.end) return false;
    const ctx = await fetchCalendarsFor(userId);
    if (!ctx) return false;
    const calendar =
      ctx.calendars.find((c) => c.url === calendarId) ??
      ctx.calendars.find((c) => (c.components ?? ["VEVENT"]).includes("VEVENT"));
    if (!calendar) return false;
    try {
      // Recover the current object's ETag (for If-Match) and its UID.
      const objects = await ctx.client.fetchCalendarObjects({
        calendar,
        objectUrls: [eventId],
      });
      const existing = objects.find((o) => o.url === eventId) ?? objects[0];
      const uid =
        input.icalUid ??
        (existing && typeof existing.data === "string" ? extractIcsUid(existing.data) : null);
      if (!uid) return false;

      const iCalString = generateIcs({
        uid,
        start: input.start,
        end: input.end,
        summary: input.summary ?? "Booking",
        description: input.description,
        location: input.location,
        attendees: input.attendees,
        status: "CONFIRMED",
        sequence: input.sequence,
      });
      const res = await ctx.client.updateCalendarObject({
        calendarObject: { url: eventId, data: iCalString, etag: existing?.etag ?? "" },
      });
      return Boolean(res.ok);
    } catch {
      return false;
    }
  },

  async deleteEvent(userId, eventId): Promise<boolean> {
    const client = await getClient(userId);
    if (!client) return false;
    try {
      const res = await client.deleteCalendarObject({
        calendarObject: { url: eventId, etag: "" },
      });
      return res.ok || res.status === 404;
    } catch {
      return false;
    }
  },

  disconnect: (userId) => deleteIntegration(userId, INTEGRATION),
};
