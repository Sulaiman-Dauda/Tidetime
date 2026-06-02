import { describe, it, expect } from "vitest";
import {
  normalizeRating,
  isPositive,
  routeReview,
  summarizeRatings,
  DEFAULT_REVIEW_THRESHOLD,
} from "./reviews";

describe("normalizeRating", () => {
  it("accepts whole numbers 1-5", () => {
    expect(normalizeRating(1)).toBe(1);
    expect(normalizeRating(5)).toBe(5);
  });
  it("rounds and coerces strings", () => {
    expect(normalizeRating("4")).toBe(4);
    expect(normalizeRating(3.4)).toBe(3);
    expect(normalizeRating(3.6)).toBe(4);
  });
  it("rejects out-of-range and non-numeric values", () => {
    expect(normalizeRating(0)).toBeNull();
    expect(normalizeRating(6)).toBeNull();
    expect(normalizeRating("abc")).toBeNull();
    expect(normalizeRating(NaN)).toBeNull();
  });
});

describe("isPositive", () => {
  it("uses the default threshold", () => {
    expect(isPositive(4)).toBe(true);
    expect(isPositive(3)).toBe(false);
  });
  it("respects a custom threshold", () => {
    expect(isPositive(4, 5)).toBe(false);
    expect(isPositive(5, 5)).toBe(true);
  });
});

describe("routeReview", () => {
  const url = "https://g.page/r/abc/review";

  it("redirects positive ratings when a public URL is set", () => {
    expect(routeReview(5, { publicUrl: url, threshold: 4 })).toEqual({
      kind: "redirect",
      url,
    });
  });

  it("keeps negative ratings private even with a public URL", () => {
    expect(routeReview(2, { publicUrl: url, threshold: 4 })).toEqual({ kind: "private" });
  });

  it("stays private for positive ratings when no public URL is set", () => {
    expect(routeReview(5, { publicUrl: null, threshold: 4 })).toEqual({ kind: "private" });
  });

  it("falls back to the default threshold when threshold is falsy", () => {
    expect(routeReview(DEFAULT_REVIEW_THRESHOLD, { publicUrl: url, threshold: 0 })).toEqual({
      kind: "redirect",
      url,
    });
  });

  it("reports invalid ratings", () => {
    const res = routeReview(9, { publicUrl: url, threshold: 4 });
    expect(res.kind).toBe("invalid");
  });
});

describe("summarizeRatings", () => {
  it("computes count, average and distribution", () => {
    const s = summarizeRatings([5, 5, 4, 1]);
    expect(s.count).toBe(4);
    expect(s.average).toBe(3.75);
    expect(s.distribution[5]).toBe(2);
    expect(s.distribution[4]).toBe(1);
    expect(s.distribution[1]).toBe(1);
  });

  it("handles an empty set", () => {
    const s = summarizeRatings([]);
    expect(s.count).toBe(0);
    expect(s.average).toBe(0);
  });
});
