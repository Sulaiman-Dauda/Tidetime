"use server";

import { requireUser } from "@/lib/auth";
import { createInstantMeeting, type InstantMeetingResult } from "@/server/instant";

/** Start an instant "meet now" meeting for the signed-in host. */
export async function startInstantMeetingAction(duration: number): Promise<InstantMeetingResult> {
  const user = await requireUser();
  return createInstantMeeting(user.id, duration);
}
