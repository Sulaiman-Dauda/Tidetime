"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deleteReview } from "@/server/reviews";

export async function deleteReviewAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  await deleteReview(id, user.id);
  revalidatePath("/dashboard/reviews");
}
