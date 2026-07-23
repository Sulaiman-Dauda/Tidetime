"use server";

import { revalidatePath } from "next/cache";
import { requireAnyPermission } from "@/lib/guard";
import { moveBooking, createBooking } from "@/server/bookings";
import { hostHasConflict } from "@/server/availability";
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
  /** team managers can book on behalf of a specific provider */
  preferredHostId?: number;
  /** set after the user explicitly confirmed a double-booking warning */
  allowConflict?: boolean;
}

export type ManualBookingState = {
  ok?: boolean;
  uid?: string;
  error?: string;
  /** the chosen provider already has a booking then — needs explicit confirm */
  conflict?: boolean;
} | null;

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
  const end = new Date(start.getTime() + input.durationMin * 60_000);

  // Managers may book for any provider; members always book themselves.
  const teamManager = can(role, "booking.all.manage");
  const preferredHostId = teamManager ? input.preferredHostId : user.id;

  // The trusted force path skips availability on purpose, but a silent
  // double-booking is never what the host meant — warn once and require an
  // explicit confirm.
  if (preferredHostId && !input.allowConflict) {
    if (await hostHasConflict(preferredHostId, start, end)) {
      return {
        conflict: true,
        error: "That provider already has a booking in this time range.",
      };
    }
  }

  const res = await createBooking({
    slug: input.slug,
    teamSlug: input.teamSlug,
    preferredHostId,
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
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  return { ok: true, uid: res.uid };
}
