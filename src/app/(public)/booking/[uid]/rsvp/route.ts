import { NextRequest, NextResponse } from "next/server";
import { respondToRsvp } from "@/server/rsvp";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /booking/:uid/rsvp?status=accepted&email=…&t=… — record an attendee's RSVP
 * from a signed email link, then bounce back to the booking page with a flash.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "";
  const email = sp.get("email") ?? "";
  const token = sp.get("t") ?? "";

  const res = await respondToRsvp(uid, email, status, token);
  const dest = new URL(`/booking/${uid}`, env.appUrl);
  if (res.ok) dest.searchParams.set("rsvp", res.status!);
  else dest.searchParams.set("rsvp_error", "1");
  return NextResponse.redirect(dest, { status: 303 });
}
