import { NextRequest, NextResponse } from "next/server";
import { getPublicEventType, getSlots } from "@/server/availability";

const MAX_PUBLIC_RANGE_DAYS = 93;

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/availability?username=&slug=&from=&to=&duration=
 * Public availability for a service (no auth required).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const username = sp.get("username");
  const slug = sp.get("slug");
  if (!username || !slug) {
    return NextResponse.json({ error: "Missing username or slug" }, { status: 400 });
  }

  const resolved = await getPublicEventType(username, slug);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const from = sp.get("from");
  const to = sp.get("to");
  const rangeStart = from ? new Date(from) : new Date();
  const rangeEnd = to ? new Date(to) : new Date(rangeStart.getTime() + 33 * 24 * 60 * 60 * 1000);
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

  const rawDuration = sp.get("duration");
  const duration = rawDuration ? Number(rawDuration) : resolved.eventType.length;
  if (!Number.isFinite(duration) || duration < 5 || duration > 1440) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }
  const slots = await getSlots({ eventType: resolved.eventType, rangeStart, rangeEnd, duration });

  return NextResponse.json({ data: { slots } }, { headers: { "Cache-Control": "no-store" } });
}
