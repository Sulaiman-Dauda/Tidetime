import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { credentials } from "@/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { getAppUrl } from "@/server/app-url";
import { graphDateTime, parseGraphDate, isGraphEventBusy } from "@/lib/ms-graph";
import { getMicrosoftCreds } from "../integration-credentials";
import type {
  CalendarAdapter,
  CalendarListEntry,
  BusyInterval,
  CreateCalendarEventInput,
  CreatedCalendarEvent,
} from "./types";
import {
  deleteIntegration,
  getDestinationCalendarId,
  getSelectedCalendarIds,
  hasCredential,
} from "./store";

/* -------------------------------------------------------------------------- */
/*  Microsoft 365 / Outlook calendar via Microsoft Graph                       */
/* -------------------------------------------------------------------------- */

const INTEGRATION = "office365_calendar" as const;
const TENANT = "common";
const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const GRAPH = "https://graph.microsoft.com/v1.0";
/** offline_access → refresh tokens; Calendars.ReadWrite → busy + event CRUD */
const SCOPES = ["offline_access", "openid", "email", "User.Read", "Calendars.ReadWrite"];

interface MsTokens {
  access_token?: string;
  refresh_token?: string;
  /** epoch ms */
  expiry_date?: number;
}

async function clientCreds(): Promise<{ clientId: string; clientSecret: string }> {
  const creds = await getMicrosoftCreds();
  if (!creds) {
    throw new Error(
      "Microsoft 365 is not configured — add it in Settings → Integrations (or set MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)",
    );
  }
  return creds;
}

async function redirectUri(): Promise<string> {
  return `${await getAppUrl()}/api/microsoft-calendar/callback`;
}

/** Whether Microsoft 365 OAuth credentials are configured (DB or env). */
export async function isMicrosoftConfigured(): Promise<boolean> {
  return (await getMicrosoftCreds()) !== null;
}

/** Build the Microsoft consent URL for a user. State is signed by the caller. */
export async function getMicrosoftAuthUrl(state: string): Promise<string> {
  const { clientId } = await clientCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: await redirectUri(),
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

/** Exchange an auth code for tokens and persist the credential. */
export async function exchangeMicrosoftCode(code: string, userId: number): Promise<void> {
  const { clientId, clientSecret } = await clientCreds();
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: await redirectUri(),
      grant_type: "authorization_code",
      scope: SCOPES.join(" "),
    }),
  });
  if (!res.ok) {
    throw new Error(`Microsoft token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Microsoft returned no access token");

  const tokens: MsTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  await db
    .delete(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.type, INTEGRATION)));
  await db
    .insert(credentials)
    .values({ userId, type: INTEGRATION, key: encrypt(JSON.stringify(tokens)) });
}

/** Return a valid access token for the user, refreshing if needed. */
async function getAccessToken(userId: number): Promise<string | null> {
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

  const tokens = JSON.parse(decrypt(cred.key)) as MsTokens;

  const stillValid =
    tokens.access_token && tokens.expiry_date && tokens.expiry_date - 60_000 > Date.now();
  if (stillValid) return tokens.access_token!;

  if (!tokens.refresh_token) {
    await db.update(credentials).set({ invalid: true }).where(eq(credentials.id, cred.id));
    return null;
  }

  try {
    const { clientId, clientSecret } = await clientCreds();
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
        scope: SCOPES.join(" "),
      }),
    });
    if (!res.ok) throw new Error(`refresh failed ${res.status}`);
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) throw new Error("no access token on refresh");

    const next: MsTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    await db
      .update(credentials)
      .set({ key: encrypt(JSON.stringify(next)) })
      .where(eq(credentials.id, cred.id));
    return next.access_token!;
  } catch {
    await db.update(credentials).set({ invalid: true }).where(eq(credentials.id, cred.id));
    return null;
  }
}

async function graph(
  userId: number,
  path: string,
  init?: RequestInit & { token?: string },
): Promise<Response | null> {
  const token = init?.token ?? (await getAccessToken(userId));
  if (!token) return null;
  return fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  Adapter                                                                     */
/* -------------------------------------------------------------------------- */

export const microsoftAdapter: CalendarAdapter = {
  integration: INTEGRATION,
  label: "Microsoft 365 / Outlook",

  isConnected: (userId) => hasCredential(userId, INTEGRATION),

  async listCalendars(userId: number): Promise<CalendarListEntry[]> {
    const res = await graph(userId, "/me/calendars?$select=id,name,isDefaultCalendar&$top=100");
    if (!res || !res.ok) return [];
    const data = (await res.json()) as {
      value?: { id: string; name?: string; isDefaultCalendar?: boolean }[];
    };
    return (data.value ?? []).map((c) => ({
      id: c.id,
      summary: c.name ?? c.id,
      primary: Boolean(c.isDefaultCalendar),
    }));
  },

  async fetchBusy(userId, rangeStart, rangeEnd): Promise<BusyInterval[]> {
    const selected = await getSelectedCalendarIds(userId, INTEGRATION);
    const qs =
      `startDateTime=${encodeURIComponent(rangeStart.toISOString())}` +
      `&endDateTime=${encodeURIComponent(rangeEnd.toISOString())}` +
      `&$select=start,end,showAs,isCancelled&$top=999`;

    const paths =
      selected.length > 0
        ? selected.map((calId) => `/me/calendars/${encodeURIComponent(calId)}/calendarView?${qs}`)
        : [`/me/calendarView?${qs}`];

    const busy: BusyInterval[] = [];
    for (const path of paths) {
      // Follow @odata.nextLink so calendars with >999 events in the window are
      // fully covered (previously a busy day past page one would be missed).
      let next: string | null = path;
      let guard = 0;
      while (next && guard < 20) {
        guard++;
        const res = await graph(userId, next, {
          headers: { Prefer: 'outlook.timezone="UTC"' },
        });
        if (!res || !res.ok) break;
        const data = (await res.json()) as {
          value?: {
            start?: { dateTime?: string };
            end?: { dateTime?: string };
            showAs?: string;
            isCancelled?: boolean;
          }[];
          "@odata.nextLink"?: string;
        };
        for (const ev of data.value ?? []) {
          if (!isGraphEventBusy(ev)) continue;
          const start = parseGraphDate(ev.start);
          const end = parseGraphDate(ev.end);
          if (start && end) busy.push({ start, end });
        }
        // nextLink is an absolute URL; graph() prefixes GRAPH, so strip it.
        const link = data["@odata.nextLink"];
        next = link ? link.replace(GRAPH, "") : null;
      }
    }
    return busy;
  },

  async createEvent(
    userId: number,
    input: CreateCalendarEventInput,
  ): Promise<CreatedCalendarEvent | null> {
    const destination = await getDestinationCalendarId(userId, INTEGRATION);
    const path = destination
      ? `/me/calendars/${encodeURIComponent(destination)}/events`
      : "/me/events";

    const body: Record<string, unknown> = {
      subject: input.summary,
      body: { contentType: "HTML", content: input.description ?? "" },
      start: graphDateTime(input.start),
      end: graphDateTime(input.end),
      attendees: (input.attendees ?? []).map((a) => ({
        emailAddress: { address: a.email, name: a.name },
        type: "required",
      })),
    };
    if (input.location) body.location = { displayName: input.location };
    if (input.requestConferenceLink) {
      body.isOnlineMeeting = true;
      body.onlineMeetingProvider = "teamsForBusiness";
    }

    const res = await graph(userId, path, { method: "POST", body: JSON.stringify(body) });
    if (!res || !res.ok) {
      if (res) console.error("Microsoft event create failed:", res.status, await safeText(res));
      return null;
    }
    const data = (await res.json()) as {
      id: string;
      onlineMeeting?: { joinUrl?: string };
    };
    return {
      eventId: data.id,
      calendarId: destination ?? "default",
      meetingUrl: data.onlineMeeting?.joinUrl,
    };
  },

  async updateEvent(userId, eventId, input): Promise<boolean> {
    const body: Record<string, unknown> = {};
    if (input.summary !== undefined) body.subject = input.summary;
    if (input.description !== undefined)
      body.body = { contentType: "HTML", content: input.description ?? "" };
    if (input.start) body.start = graphDateTime(input.start);
    if (input.end) body.end = graphDateTime(input.end);
    if (input.location !== undefined) body.location = { displayName: input.location };

    const res = await graph(userId, `/me/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return Boolean(res && res.ok);
  },

  async deleteEvent(userId, eventId): Promise<boolean> {
    const res = await graph(userId, `/me/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
    return Boolean(res && (res.ok || res.status === 404));
  },

  disconnect: (userId) => deleteIntegration(userId, INTEGRATION),
};

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}
