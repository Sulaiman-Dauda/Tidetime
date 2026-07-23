"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/guard";
import { decideBooking } from "@/server/bookings";
import { cancelBooking } from "@/server/bookings";
import { bookingForActor } from "@/server/booking-authorization";

const decideSchema = z.object({
  uid: z.string().min(1),
  decision: z.enum(["accepted", "rejected"]),
});

export async function decideBookingAction(formData: FormData) {
  const { user, role, teamId } = await requireAnyPermission([
    "booking.own.manage",
    "booking.all.manage",
  ]);
  const parsed = decideSchema.safeParse({
    uid: formData.get("uid"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return;
  const booking = await bookingForActor({
    uid: parsed.data.uid,
    userId: user.id,
    teamId,
    role,
    operation: "manage",
  });
  if (!booking?.userId) return;
  await decideBooking(parsed.data.uid, parsed.data.decision, booking.userId);
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${parsed.data.uid}`);
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
}

export async function cancelByHostAction(formData: FormData) {
  const { user, role, teamId } = await requireAnyPermission([
    "booking.own.manage",
    "booking.all.manage",
  ]);
  const uid = formData.get("uid");
  if (typeof uid !== "string") return;

  const booking = await bookingForActor({
    uid,
    userId: user.id,
    teamId,
    role,
    operation: "manage",
  });
  if (!booking) return;

  const reason = formData.get("reason");
  await cancelBooking(uid, typeof reason === "string" ? reason : undefined, "host");
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${uid}`);
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
}
