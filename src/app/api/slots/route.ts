import { NextRequest, NextResponse } from "next/server";
import { getPublicEventType, getSlots } from "@/server/availability";
import { groupSlotsByDay, parsePublicSlotRange } from "@/lib/slots";
import { isValidTimeZone } from "@/lib/time";
import { isBookingDisabled } from "@/server/company-settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/slots?username=jane&slug=intro&start=YYYY-MM-DD&end=YYYY-MM-DD&duration=30&tz=...
 * Returns slots grouped by day in the viewer's timezone.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const username = sp.get("username");
  const slug = sp.get("slug");
  if (!username || !slug) {
    return NextResponse.json({ error: "Missing username or slug" }, { status: 400 });
  }

  if (await isBookingDisabled()) {
    return NextResponse.json({ error: "Booking is temporarily disabled" }, { status: 503 });
  }

  const result = await getPublicEventType(username, slug);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const requestedTz = sp.get("tz");
  const viewerTz = requestedTz && isValidTimeZone(requestedTz) ? requestedTz : result.eventType.scheduleTimeZone;

  const rawDuration = sp.get("duration");
  const duration = rawDuration ? Number(rawDuration) : result.eventType.length;
  if (!Number.isFinite(duration) || duration < 5 || duration > 1440) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  const range = parsePublicSlotRange(sp.get("start"), sp.get("end"));
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });
  const { rangeStart, rangeEnd } = range;

  const slots = await getSlots({ eventType: result.eventType, rangeStart, rangeEnd, duration });
  const grouped = groupSlotsByDay(slots, viewerTz);

  return NextResponse.json(
    { slots, byDay: grouped },
    { headers: { "Cache-Control": "no-store" } },
  );
}
