import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthorization } from "@/lib/guard";
import { can } from "@/lib/rbac";
import {
  getGoogleDestinationCalendar,
  getSelectedCalendars,
  hasExpiredGoogleCredential,
  isGoogleConnected,
  listGoogleCalendars,
  setGoogleDestinationCalendar,
  setSelectedCalendars,
} from "@/server/google-calendar";

export const dynamic = "force-dynamic";

async function authorize() {
  const authorization = await getCurrentAuthorization();
  if (!authorization) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!authorization.role || !can(authorization.role, "connection.own.manage")) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user: authorization.user };
}

/** GET /api/google-calendar/calendars — list user's Google calendars. */
export async function GET(_req: NextRequest) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { user } = authorization;

  const connected = await isGoogleConnected(user.id);
  if (!connected) {
    return NextResponse.json({
      connected: false,
      expired: await hasExpiredGoogleCredential(user.id),
      calendars: [],
      selected: [],
      destinationCalendarId: null,
    });
  }

  const [calendars, selected, destinationCalendarId] = await Promise.all([
    listGoogleCalendars(user.id),
    getSelectedCalendars(user.id),
    getGoogleDestinationCalendar(user.id),
  ]);
  return NextResponse.json({ connected: true, calendars, selected, destinationCalendarId });
}

/** POST /api/google-calendar/calendars — save selected calendars. */
export async function POST(req: NextRequest) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const { user } = authorization;

  const connected = await isGoogleConnected(user.id);
  if (!connected) {
    return NextResponse.json({ error: "Google Calendar is not connected" }, { status: 400 });
  }

  const {
    calendarIds,
    destinationCalendarId,
  } = (await req.json()) as { calendarIds?: string[]; destinationCalendarId?: string | null };

  if (Array.isArray(calendarIds)) {
    await setSelectedCalendars(user.id, calendarIds);
  }
  if (destinationCalendarId !== undefined) {
    await setGoogleDestinationCalendar(user.id, destinationCalendarId || null);
  }

  return NextResponse.json({ ok: true });
}
