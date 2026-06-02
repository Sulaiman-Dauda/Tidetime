import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, attendees } from "@/db/schema";
import { authenticateApiKey, unauthorized, jsonError } from "@/server/api-auth";
import { cancelBooking, decideBooking } from "@/server/bookings";

export const dynamic = "force-dynamic";

/** GET /api/v1/bookings/:uid — fetch a single booking. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { uid } = await params;

  const [b] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!b || b.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ats = await db.select().from(attendees).where(eq(attendees.bookingId, b.id));
  return NextResponse.json({ data: { ...b, attendees: ats } });
}

const patchSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
});

/** PATCH /api/v1/bookings/:uid — confirm or reject a pending booking. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { uid } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input");

  const result = await decideBooking(uid, parsed.data.status, user.id);
  if (!result.ok) return jsonError(result.error ?? "Could not update booking", 422);
  return NextResponse.json({ data: { uid, status: parsed.data.status } });
}

/** DELETE /api/v1/bookings/:uid — cancel a booking. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const user = await authenticateApiKey(req);
  if (!user) return unauthorized();
  const { uid } = await params;

  const [b] = await db.select().from(bookings).where(eq(bookings.uid, uid)).limit(1);
  if (!b || b.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reason = req.nextUrl.searchParams.get("reason") ?? undefined;
  const result = await cancelBooking(uid, reason);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

  return NextResponse.json({ data: { uid, status: "cancelled" } });
}
