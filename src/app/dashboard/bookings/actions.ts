"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
  await requireUser();
  const uid = formData.get("uid");
  if (typeof uid !== "string") return;
  const reason = formData.get("reason");
  await cancelBooking(uid, typeof reason === "string" ? reason : undefined);
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${uid}`);
}
