"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { submitReview } from "@/server/reviews";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import type { ReviewOutcome } from "@/lib/reviews";

const schema = z.object({
  uid: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  feedback: z.string().trim().max(1000).optional(),
});

export type ReviewActionState =
  | { error: string }
  | { ok: true; outcome: ReviewOutcome }
  | null;

export async function submitReviewAction(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const parsed = schema.safeParse({
    uid: formData.get("uid"),
    rating: formData.get("rating"),
    feedback: formData.get("feedback") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ip = clientIpFromHeaders(await headers());
  if (!checkRateLimit(`review:ip:${ip}`, { limit: 15, windowMs: 60 * 1000 }).ok) {
    return { error: "Too many submissions. Please slow down and try again." };
  }

  const res = await submitReview(parsed.data.uid, parsed.data.rating, parsed.data.feedback);
  if (!res.ok || !res.outcome) return { error: res.error ?? "Could not submit review" };
  return { ok: true, outcome: res.outcome };
}
