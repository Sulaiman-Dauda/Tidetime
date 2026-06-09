import { NextRequest, NextResponse } from "next/server";
import { getTeamEventType, getTeamSlots, groupTeamSlotsByDay } from "@/server/teams-public";
import { parsePublicSlotRange } from "@/lib/slots";
import { isValidTimeZone } from "@/lib/time";
import { isBookingDisabled } from "@/server/company-settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/slots/team?team=acme&slug=intro&start=YYYY-MM-DD&end=YYYY-MM-DD&duration=30&tz=...
 * Returns merged team slots grouped by day in the viewer's timezone.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const teamSlug = sp.get("team");
  const slug = sp.get("slug");
  if (!teamSlug || !slug) {
    return NextResponse.json({ error: "Missing team or slug" }, { status: 400 });
  }

  if (await isBookingDisabled()) {
    return NextResponse.json({ error: "Booking is temporarily disabled" }, { status: 503 });
  }

  const resolved = await getTeamEventType(teamSlug, slug);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const requestedTz = sp.get("tz");
  const viewerTz = requestedTz && isValidTimeZone(requestedTz) ? requestedTz : resolved.eventType.scheduleTimeZone;

  const rawDuration = sp.get("duration");
  const duration = rawDuration ? Number(rawDuration) : resolved.eventType.length;
  if (!Number.isFinite(duration) || duration < 5 || duration > 1440) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  const range = parsePublicSlotRange(sp.get("start"), sp.get("end"));
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });
  const { rangeStart, rangeEnd } = range;

  const hostParam = sp.get("host");
  const preferredHostId = hostParam ? Number(hostParam) : undefined;
  const slots = await getTeamSlots({
    eventType: resolved.eventType,
    rangeStart,
    rangeEnd,
    duration,
    preferredHostId:
      preferredHostId && Number.isInteger(preferredHostId) ? preferredHostId : undefined,
  });
  const byDay = groupTeamSlotsByDay(slots, viewerTz);

  return NextResponse.json({ slots, byDay }, { headers: { "Cache-Control": "no-store" } });
}
