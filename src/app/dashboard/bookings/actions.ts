"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { requireAnyPermission } from "@/lib/guard";
import { decideBooking } from "@/server/bookings";
import { cancelBooking } from "@/server/bookings";

const decideSchema = z.object({
  uid: z.string().min(1),
  decision: z.enum(["accepted", "rejected"]),
});

export async function decideBookingAction(formData: FormData) {
  const { user } = await requireAnyPermission(["booking.own.manage", "booking.all.manage"]);
  const parsed = decideSchema.safeParse({
    uid: formData.get("uid"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return;
  await decideBooking(parsed.data.uid, parsed.data.decision, user.id);
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${parsed.data.uid}`);
}

export async function cancelByHostAction(formData: FormData) {
  const { user } = await requireAnyPermission(["booking.own.manage", "booking.all.manage"]);
  const uid = formData.get("uid");
  if (typeof uid !== "string") return;

  // Ownership: only the assigned provider may cancel the booking.
  const [b] = await db
    .select({ id: bookings.id, userId: bookings.userId })
    .from(bookings)
    .where(eq(bookings.uid, uid))
    .limit(1);
  if (!b) return;
  if (b.userId !== user.id) return;

  const reason = formData.get("reason");
  await cancelBooking(uid, typeof reason === "string" ? reason : undefined);
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${uid}`);
}
