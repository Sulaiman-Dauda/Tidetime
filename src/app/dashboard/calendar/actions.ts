"use server";

import { revalidatePath } from "next/cache";
import { requireAnyPermission } from "@/lib/guard";
import { moveBooking, createBooking } from "@/server/bookings";
import { zonedTimeToUtc } from "@/lib/time";
import { bookingForActor } from "@/server/booking-authorization";
import { can } from "@/lib/rbac";

export type MoveState = { ok?: boolean; error?: string } | null;

/** Drag-to-reschedule from the dashboard calendar: move a booking to newStartIso. */
export async function moveBookingAction(uid: string, newStartIso: string): Promise<MoveState> {
  const { user, role, teamId } = await requireAnyPermission([
    "booking.own.manage",
    "booking.all.manage",
  ]);
  const booking = await bookingForActor({
    uid,
    userId: user.id,
    teamId,
    role,
    operation: "manage",
  });
  if (!booking?.userId) return { error: "Booking not found" };
  const res = await moveBooking(uid, booking.userId, newStartIso);
  if (!res.ok) return { error: res.error };
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export interface ManualBookingInput {
  slug: string;
  teamSlug: string;
  /** YYYY-MM-DD in the host's timezone */
  date: string;
  /** HH:MM (24h) in the host's timezone */
  time: string;
  durationMin: number;
  name: string;
  email: string;
  notes?: string;
}

export type ManualBookingState = { ok?: boolean; uid?: string; error?: string } | null;

/**
 * Drag-to-create / quick-add from the dashboard calendar: the host books a slot
 * manually for a customer. Uses the trusted `force` path so it confirms
 * immediately, bypassing public availability and approval checks.
 */
export async function createManualBookingAction(
  input: ManualBookingInput,
): Promise<ManualBookingState> {
  const { user, role } = await requireAnyPermission([
    "booking.own.manage",
    "booking.all.manage",
  ]);

  const [y, mo, d] = input.date.split("-").map(Number);
  const [hh, mm] = input.time.split(":").map(Number);
  if (![y, mo, d, hh, mm].every((n) => Number.isFinite(n))) {
    return { error: "Invalid date or time" };
  }
  if (!input.name.trim() || !input.email.trim()) {
    return { error: "Add the attendee's name and email" };
  }
  if (!input.slug || !input.teamSlug) return { error: "Pick a service" };
  if (!Number.isFinite(input.durationMin) || input.durationMin <= 0) {
    return { error: "Invalid duration" };
  }

  const start = zonedTimeToUtc(y, mo, d, hh, mm, user.timeZone);
  const res = await createBooking({
    slug: input.slug,
    teamSlug: input.teamSlug,
    preferredHostId: can(role, "booking.all.manage") ? undefined : user.id,
    start: start.toISOString(),
    duration: input.durationMin,
    timeZone: user.timeZone,
    name: input.name.trim(),
    email: input.email.trim(),
    responses: input.notes?.trim() ? { notes: input.notes.trim() } : {},
    force: true,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/dashboard/calendar");
  return { ok: true, uid: res.uid };
}
