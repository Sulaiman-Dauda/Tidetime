"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, bookingHosts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { decideBooking } from "@/server/bookings";
import { cancelBooking } from "@/server/bookings";

const decideSchema = z.object({
  uid: z.string().min(1),
  decision: z.enum(["accepted", "rejected"]),
});

export async function decideBookingAction(formData: FormData) {
  const user = await requireUser();
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
  const user = await requireUser();
  const uid = formData.get("uid");
  if (typeof uid !== "string") return;

  // Ownership: only the assigned host or a co-host on the booking may cancel it
  // (mirrors decideBooking). Without this any signed-in user who learns a uid
  // could cancel a booking they don't own.
  const [b] = await db
    .select({ id: bookings.id, userId: bookings.userId })
    .from(bookings)
    .where(eq(bookings.uid, uid))
    .limit(1);
  if (!b) return;
  let owns = b.userId === user.id;
  if (!owns) {
    const [co] = await db
      .select({ userId: bookingHosts.userId })
      .from(bookingHosts)
      .where(and(eq(bookingHosts.bookingId, b.id), eq(bookingHosts.userId, user.id)))
      .limit(1);
    owns = Boolean(co);
  }
  if (!owns) return;

  const reason = formData.get("reason");
  await cancelBooking(uid, typeof reason === "string" ? reason : undefined);
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${uid}`);
}
