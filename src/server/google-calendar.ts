import "server-only";
import { timingSafeEqual } from "node:crypto";
import { google } from "googleapis";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { credentials, selectedCalendars, destinationCalendars } from "@/db/schema";
import { encrypt, decrypt, hmacSign } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getAppUrl } from "@/server/app-url";
import { getGoogleCreds } from "./integration-credentials";

/* -------------------------------------------------------------------------- */
/*  OAuth2 client helpers                                                      */
/* -------------------------------------------------------------------------- */

async function getOAuthClient() {
  const creds = await getGoogleCreds();
  if (!creds) {
    throw new Error(
      "Google OAuth is not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
    );
  }
  return new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    `${await getAppUrl()}/api/google-calendar/callback`,
  );
}

function googleState(userId: number, issuedAt = Date.now()): string {
  const payload = `${userId}:${issuedAt}`;
  const sig = hmacSign(payload, env.authSecret);
  return `${payload}:${sig}`;
}

/** Validate a Google OAuth state token and return its user id. */
export function parseGoogleOAuthState(state: string): number | null {
  const [userIdRaw, issuedAtRaw, sig] = state.split(":");
  if (!userIdRaw || !issuedAtRaw || !sig) return null;

  const payload = `${userIdRaw}:${issuedAtRaw}`;
  const expected = hmacSign(payload, env.authSecret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const userId = Number(userIdRaw);
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > 15 * 60 * 1000) return null;
  return userId;
}

/** Build the Google OAuth consent URL for a user. */
export async function getGoogleAuthUrl(userId: number): Promise<string> {
  const oauth = await getOAuthClient();
  return oauth.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    state: googleState(userId),
    prompt: "consent",
  });
}

/** Exchange an OAuth code for tokens and persist the credential. */
export async function exchangeGoogleCode(code: string, userId: number): Promise<void> {
  const oauth = await getOAuthClient();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.access_token) throw new Error("Google returned no access token");

  await db.delete(credentials).where(eq(credentials.userId, userId));

  const encrypted = encrypt(JSON.stringify(tokens));
  await db
    .insert(credentials)
    .values({ userId, key: encrypted });
}

/** Retrieve and refresh the Google credential for a user. */
async function getGoogleCredential(userId: number): Promise<{ oauth: Awaited<ReturnType<typeof getOAuthClient>>; tokens: { access_token?: string; refresh_token?: string } } | null> {
  const [cred] = await db
    .select()
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.invalid, false)))
    .limit(1);
  if (!cred) return null;

  const tokens = JSON.parse(decrypt(cred.key));
  const oauth = await getOAuthClient();
  oauth.setCredentials(tokens);

  // Auto-refresh access token if needed.
  if (!tokens.access_token || tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials: refreshed } = await oauth.refreshAccessToken();
      const next = { ...tokens, ...refreshed };
      await db
        .update(credentials)
        .set({ key: encrypt(JSON.stringify(next)) })
        .where(eq(credentials.id, cred.id));
      oauth.setCredentials(next);
    } catch {
      // Mark credential as invalid so it doesn't keep failing.
      await db.update(credentials).set({ invalid: true }).where(eq(credentials.id, cred.id));
      return null;
    }
  }

  return { oauth, tokens };
}

/** Disconnect Google Calendar for a user. */
export async function disconnectGoogleCalendar(userId: number): Promise<void> {
  await db.delete(credentials).where(eq(credentials.userId, userId));
  await db.delete(selectedCalendars).where(eq(selectedCalendars.userId, userId));
  await db.delete(destinationCalendars).where(eq(destinationCalendars.userId, userId));
}

/** Check if a user has Google Calendar connected. */
export async function isGoogleConnected(userId: number): Promise<boolean> {
  if (!userId) return false;
  const [cred] = await db
    .select({ id: credentials.id })
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.invalid, false)))
    .limit(1);
  return Boolean(cred);
}

/* -------------------------------------------------------------------------- */
/*  Calendar listing & selection                                               */
/* -------------------------------------------------------------------------- */

export interface GoogleCalendarView {
  id: string;
  summary: string;
  primary: boolean;
}

/** List user's Google Calendars. */
export async function listGoogleCalendars(userId: number): Promise<GoogleCalendarView[]> {
  const cred = await getGoogleCredential(userId);
  if (!cred) return [];

  const calendar = google.calendar({ version: "v3", auth: cred.oauth });
  const res = await calendar.calendarList.list();
  return (res.data.items ?? []).map((c) => ({
    id: c.id!,
    summary: c.summary ?? c.id!,
    primary: c.primary ?? false,
  }));
}

/** Get the user's selected calendars. */
export async function getSelectedCalendars(userId: number): Promise<string[]> {
  const rows = await db
    .select({ externalId: selectedCalendars.externalId })
    .from(selectedCalendars)
    .where(eq(selectedCalendars.userId, userId));
  return rows.map((r) => r.externalId);
}

/** Save selected calendars. */
export async function setSelectedCalendars(userId: number, calendarIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(selectedCalendars)
      .where(eq(selectedCalendars.userId, userId));
    if (calendarIds.length > 0) {
      await tx.insert(selectedCalendars).values(
        calendarIds.map((externalId) => ({
          userId,
          externalId,
        })),
      );
    }
  });
}

/** Destination calendar for newly-created booking events. */
export async function getGoogleDestinationCalendar(userId: number): Promise<string | null> {
  const [row] = await db
    .select({ externalId: destinationCalendars.externalId })
    .from(destinationCalendars)
    .where(eq(destinationCalendars.userId, userId))
    .limit(1);
  return row?.externalId ?? null;
}

/** Save the destination calendar for new booking events. */
export async function setGoogleDestinationCalendar(
  userId: number,
  calendarId: string | null,
): Promise<void> {
  await db
    .delete(destinationCalendars)
    .where(eq(destinationCalendars.userId, userId));

  if (!calendarId) return;

  await db.insert(destinationCalendars).values({
    userId,
    externalId: calendarId,
  });
}

/* -------------------------------------------------------------------------- */
/*  Busy-time query (read-only sync)                                           */
/* -------------------------------------------------------------------------- */

export interface BusyInterval {
  start: string;
  end: string;
}

/** Fetch busy intervals from the user's selected Google calendars. */
export async function fetchGoogleBusyTime(
  userId: number,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusyInterval[]> {
  const cred = await getGoogleCredential(userId);
  if (!cred) return [];

  const calendarIds = await getSelectedCalendars(userId);
  if (calendarIds.length === 0) {
    // If no calendars are explicitly selected, try the primary calendar.
    const list = await listGoogleCalendars(userId);
    const primary = list.find((c) => c.primary);
    if (primary) calendarIds.push(primary.id);
  }
  if (calendarIds.length === 0) return [];

  const calendar = google.calendar({ version: "v3", auth: cred.oauth });

  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        items: calendarIds.map((id) => ({ id })),
      },
    });

    const busy: BusyInterval[] = [];
    for (const [, calData] of Object.entries(res.data.calendars ?? {})) {
      if (calData.errors) continue;
      for (const b of calData.busy ?? []) {
        if (b.start && b.end) {
          busy.push({ start: b.start, end: b.end });
        }
      }
    }
    return busy;
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/*  Create/update/delete Google Calendar events                                */
/* -------------------------------------------------------------------------- */

export interface CreateGoogleEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  timeZone: string;
  attendees?: { email: string; name: string }[];
  meetingUrl?: string;
}

async function resolveDestinationCalendarId(userId: number): Promise<string> {
  return (await getGoogleDestinationCalendar(userId)) ?? "primary";
}

/** Create a Google Calendar event on the user's destination calendar. */
export async function createGoogleCalendarEvent(
  userId: number,
  input: CreateGoogleEventInput,
): Promise<{ eventId: string; calendarId: string; meetingUrl?: string } | null> {
  const cred = await getGoogleCredential(userId);
  if (!cred) return null;

  const calendarId = await resolveDestinationCalendarId(userId);
  const calendar = google.calendar({ version: "v3", auth: cred.oauth });
  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
        end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
        location: input.location,
        attendees: input.attendees?.map((a) => ({ email: a.email, displayName: a.name })),
        conferenceData: input.meetingUrl
          ? {
              createRequest: {
                requestId: `${Date.now()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            }
          : undefined,
      },
      conferenceDataVersion: input.meetingUrl ? 1 : 0,
    });

    return {
      eventId: res.data.id!,
      calendarId,
      meetingUrl: res.data.hangoutLink ?? res.data.conferenceData?.entryPoints?.[0]?.uri ?? undefined,
    };
  } catch (err) {
    console.error("Failed to create Google Calendar event:", err);
    return null;
  }
}

/** Update a Google Calendar event. */
export async function updateGoogleCalendarEvent(
  userId: number,
  eventId: string,
  input: Partial<CreateGoogleEventInput>,
  calendarId?: string | null,
): Promise<boolean> {
  const cred = await getGoogleCredential(userId);
  if (!cred) return false;

  const targetCalendarId = calendarId ?? (await resolveDestinationCalendarId(userId));
  const calendar = google.calendar({ version: "v3", auth: cred.oauth });
  try {
    await calendar.events.patch({
      calendarId: targetCalendarId,
      eventId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: input.start ? { dateTime: input.start.toISOString(), timeZone: input.timeZone } : undefined,
        end: input.end ? { dateTime: input.end.toISOString(), timeZone: input.timeZone } : undefined,
        location: input.location,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Delete a Google Calendar event. */
export async function deleteGoogleCalendarEvent(
  userId: number,
  eventId: string,
  calendarId?: string | null,
): Promise<boolean> {
  const cred = await getGoogleCredential(userId);
  if (!cred) return false;

  const targetCalendarId = calendarId ?? (await resolveDestinationCalendarId(userId));
  const calendar = google.calendar({ version: "v3", auth: cred.oauth });
  try {
    await calendar.events.delete({ calendarId: targetCalendarId, eventId });
    return true;
  } catch {
    return false;
  }
}
