/**
 * Pure review-routing logic — no DB / server-only imports, so it is unit
 * testable and reusable on both client and server.
 *
 * Review-routing flow:
 *   - A happy rating (>= threshold) is sent to a public review URL
 *     (for example, Google Reviews) to encourage public feedback.
 *   - An unhappy rating (< threshold) is captured privately so the provider
 *     can follow up without a public negative review.
 */

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const DEFAULT_REVIEW_THRESHOLD = 4;

export type ReviewOutcome =
  | { kind: "redirect"; url: string }
  | { kind: "private" }
  | { kind: "invalid"; error: string };

export interface ReviewSettings {
  /** public review URL (Google Reviews etc.); null disables redirects */
  publicUrl: string | null;
  /** ratings at or above this value are treated as positive */
  threshold: number;
}

/** Clamp/validate an arbitrary rating input to an integer 1-5. */
export function normalizeRating(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < MIN_RATING || r > MAX_RATING) return null;
  return r;
}

export function isPositive(rating: number, threshold = DEFAULT_REVIEW_THRESHOLD): boolean {
  return rating >= threshold;
}

/**
 * Decide where a submitted rating should go.
 * Positive + a configured public URL → redirect; otherwise collect privately.
 */
export function routeReview(rating: unknown, settings: ReviewSettings): ReviewOutcome {
  const r = normalizeRating(rating);
  if (r === null) return { kind: "invalid", error: "Rating must be a whole number from 1 to 5" };

  const threshold = settings.threshold || DEFAULT_REVIEW_THRESHOLD;
  if (isPositive(r, threshold) && settings.publicUrl) {
    return { kind: "redirect", url: settings.publicUrl };
  }
  return { kind: "private" };
}

/** Aggregate stats for a set of ratings (lightweight analytics). */
export function summarizeRatings(ratings: number[]): {
  count: number;
  average: number;
  distribution: Record<number, number>;
} {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const raw of ratings) {
    const r = normalizeRating(raw);
    if (r === null) continue;
    distribution[r] += 1;
    sum += r;
  }
  const count = ratings.length;
  return {
    count,
    average: count ? Math.round((sum / count) * 100) / 100 : 0,
    distribution,
  };
}
