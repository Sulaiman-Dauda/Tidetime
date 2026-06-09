import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, bookingReferences, users } from "@/db/schema";
import { shortId } from "@/lib/crypto";
import { env } from "@/lib/env";
import { provisionAnyVideoMeeting } from "@/app-store/conferencing";
import { logBookingActivity } from "./activity";

export interface InstantMeetingResult {
  ok: boolean;
  error?: string;
  uid?: string;
  joinUrl?: string;
  shareUrl?: string;
}

/**
 * "Meet now": mint a video room on a connected provider and create an immediate,
 * already-accepted booking starting now. Returns a shareable join link.
 */
export async function createInstantMeeting(
  userId: number,
  durationMinutes = 30,
): Promise<InstantMeetingResult> {
  const duration = Math.min(Math.max(durationMinutes, 5), 480);
  const start = new Date();
  const end = new Date(start.getTime() + duration * 60_000);

  const [host] = await db
    .select({ name: users.name, username: users.username, timeZone: users.timeZone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!host) return { ok: false, error: "User not found" };

  const topic = `Instant meeting with ${host.name ?? host.username}`;
  const provisioned = await provisionAnyVideoMeeting({
    userId,
    topic,
    start,
    end,
    timeZone: host.timeZone,
  });
  if (!provisioned) {
    return {
      ok: false,
      error: "Connect Zoom or Daily under Connections to start instant meetings.",
    };
  }

  const uid = shortId();
  const [booking] = await db
    .insert(bookings)
    .values({
      uid,
      userId,
      title: topic,
      startTime: start,
      endTime: end,
      status: "accepted",
      location: "Video call",
      meetingUrl: provisioned.meeting.url,
    })
    .returning({ id: bookings.id });

  await db.insert(bookingReferences).values({
    bookingId: booking.id,
    type: provisioned.slug,
    uid: provisioned.meeting.id,
    meetingUrl: provisioned.meeting.url,
    externalCalendarId: null,
    credentialId: null,
  });

  await logBookingActivity(booking.id, "created", {
    actor: host.username,
    message: "Instant meeting created",
  });

  return {
    ok: true,
    uid,
    joinUrl: provisioned.meeting.url,
    shareUrl: `${env.appUrl}/meet/${uid}`,
  };
}
