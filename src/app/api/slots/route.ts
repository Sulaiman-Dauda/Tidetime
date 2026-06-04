import { NextRequest, NextResponse } from "next/server";
import { getPublicEventType, getSlots } from "@/server/availability";
import { groupSlotsByDay } from "@/lib/slots";
import { isValidTimeZone } from "@/lib/time";
import { isBookingDisabled } from "@/server/company-settings";

const MAX_PUBLIC_RANGE_DAYS = 93;

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

  // Default to a 32-day window from the requested start (or today).
  const startParam = sp.get("start");
  const endParam = sp.get("end");
  const rangeStart = startParam ? new Date(`${startParam}T00:00:00Z`) : new Date();
  const rangeEnd = endParam
    ? new Date(`${endParam}T23:59:59Z`)
    : new Date(rangeStart.getTime() + 33 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  if (rangeEnd < rangeStart) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }
  const spanDays = (rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > MAX_PUBLIC_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Range cannot exceed ${MAX_PUBLIC_RANGE_DAYS} days` },
      { status: 400 },
    );
  }

  const slots = await getSlots({ eventType: result.eventType, rangeStart, rangeEnd, duration });
  const grouped = groupSlotsByDay(slots, viewerTz);

  return NextResponse.json(
    { slots, byDay: grouped },
    { headers: { "Cache-Control": "no-store" } },
  );
}
