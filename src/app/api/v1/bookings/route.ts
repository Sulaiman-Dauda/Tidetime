import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { bookings, attendees } from "@/db/schema";
import { authenticateApiKey, unauthorized, jsonError, parsePage, enforceApiRateLimit } from "@/server/api-auth";
import { createBooking } from "@/server/bookings";
import { getPublicEventType } from "@/server/availability";
import { timeZoneSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/v1/bookings — list bookings, optional ?status= & date range. */
export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const conditions = [eq(bookings.userId, user.id)];

  const status = sp.get("status");
  if (status && ["pending", "accepted", "cancelled", "rejected"].includes(status)) {
    conditions.push(eq(bookings.status, status as "pending" | "accepted" | "cancelled" | "rejected"));
  }
  const from = sp.get("from");
  if (from) {
    const fromDate = new Date(from);
    if (Number.isNaN(fromDate.getTime())) return jsonError("Invalid from date");
    conditions.push(gte(bookings.startTime, fromDate));
  }
  const to = sp.get("to");
  if (to) {
    const toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) return jsonError("Invalid to date");
    conditions.push(lte(bookings.startTime, toDate));
  }

  const { limit, offset } = parsePage(req);
  const rows = await db
    .select()
    .from(bookings)
    .where(and(...conditions))
    .orderBy(desc(bookings.startTime))
    .limit(limit)
    .offset(offset);

  const ats = rows.length
    ? await db.select().from(attendees).where(inArray(attendees.bookingId, rows.map((r) => r.id)))
    : [];

  const data = rows.map((b) => ({
    ...b,
    attendees: ats.filter((a) => a.bookingId === b.id),
  }));

  return NextResponse.json({ data, page: { limit, offset } });
}

const createSchema = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  start: z.string().datetime(),
  duration: z.number().int().positive().optional(),
  timeZone: timeZoneSchema,
  name: z.string().min(1),
  email: z.string().email(),
  responses: z.record(z.unknown()).optional(),
  guests: z.array(z.string().email()).optional(),
});

/** POST /api/v1/bookings — create a booking on behalf of an attendee. */
export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();

  // Tighter write throttle than reads.
  const limited = enforceApiRateLimit(user, 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  const resolved = await getPublicEventType(parsed.data.username, parsed.data.slug);
  if (!resolved || resolved.eventType.userId !== user.id) {
    return jsonError("Event type not found", 404);
  }

  const result = await createBooking({ ...parsed.data, responses: parsed.data.responses ?? {} });
  if (!result.ok) return jsonError(result.error ?? "Could not create booking", 422);

  return NextResponse.json({ data: { uid: result.uid } }, { status: 201 });
}
