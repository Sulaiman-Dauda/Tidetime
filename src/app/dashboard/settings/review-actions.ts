"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export type ReviewSettingsState = { ok?: boolean; error?: string } | null;

const reviewSchema = z.object({
  reviewRequestsEnabled: z.coerce.boolean(),
  googleReviewUrl: z.string().url().max(500).optional().or(z.literal("")),
  reviewThreshold: z.coerce.number().int().min(1).max(5),
});

export async function updateReviewSettingsAction(
  _prev: ReviewSettingsState,
  formData: FormData,
): Promise<ReviewSettingsState> {
  const user = await requireAdmin();
  const parsed = reviewSchema.safeParse({
    reviewRequestsEnabled: formData.get("reviewRequestsEnabled") === "on",
    googleReviewUrl: formData.get("googleReviewUrl") || "",
    reviewThreshold: formData.get("reviewThreshold"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await db
    .update(users)
    .set({
      reviewRequestsEnabled: parsed.data.reviewRequestsEnabled,
      googleReviewUrl: parsed.data.googleReviewUrl ? parsed.data.googleReviewUrl : null,
      reviewThreshold: parsed.data.reviewThreshold,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
