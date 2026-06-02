import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  resetRateLimit,
  isHoneypotFilled,
  isSubmittedTooFast,
  clientIpFromHeaders,
} from "./rate-limit";

afterEach(() => resetRateLimit());

describe("checkRateLimit", () => {
  it("allows hits up to the limit then blocks", () => {
    const opts = { limit: 3, windowMs: 1000 };
    const t0 = 1_000_000;
    expect(checkRateLimit("k", opts, t0).ok).toBe(true);
    expect(checkRateLimit("k", opts, t0).ok).toBe(true);
    const third = checkRateLimit("k", opts, t0);
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = checkRateLimit("k", opts, t0);
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterMs).toBe(1000);
  });

  it("resets after the window elapses", () => {
    const opts = { limit: 1, windowMs: 1000 };
    const t0 = 5_000_000;
    expect(checkRateLimit("w", opts, t0).ok).toBe(true);
    expect(checkRateLimit("w", opts, t0 + 500).ok).toBe(false);
    expect(checkRateLimit("w", opts, t0 + 1000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 1000 };
    const t0 = 2_000_000;
    expect(checkRateLimit("a", opts, t0).ok).toBe(true);
    expect(checkRateLimit("b", opts, t0).ok).toBe(true);
    expect(checkRateLimit("a", opts, t0).ok).toBe(false);
  });

  it("reports decreasing remaining", () => {
    const opts = { limit: 5, windowMs: 1000 };
    const t0 = 9_000_000;
    expect(checkRateLimit("r", opts, t0).remaining).toBe(4);
    expect(checkRateLimit("r", opts, t0).remaining).toBe(3);
  });
});

describe("resetRateLimit", () => {
  it("clears a single key", () => {
    const opts = { limit: 1, windowMs: 1000 };
    const t0 = 3_000_000;
    checkRateLimit("x", opts, t0);
    resetRateLimit("x");
    expect(checkRateLimit("x", opts, t0).ok).toBe(true);
  });
});

describe("isHoneypotFilled", () => {
  it("flags non-empty strings", () => {
    expect(isHoneypotFilled("bot")).toBe(true);
    expect(isHoneypotFilled("  spam ")).toBe(true);
  });
  it("ignores empty/blank/non-strings", () => {
    expect(isHoneypotFilled("")).toBe(false);
    expect(isHoneypotFilled("   ")).toBe(false);
    expect(isHoneypotFilled(undefined)).toBe(false);
    expect(isHoneypotFilled(null)).toBe(false);
    expect(isHoneypotFilled(123)).toBe(false);
  });
});

describe("isSubmittedTooFast", () => {
  it("flags submissions under the threshold", () => {
    expect(isSubmittedTooFast(1000, 2000, 2500)).toBe(true);
  });
  it("allows submissions past the threshold", () => {
    expect(isSubmittedTooFast(1000, 2000, 3500)).toBe(false);
  });
  it("allows when render time is unknown", () => {
    expect(isSubmittedTooFast(undefined)).toBe(false);
    expect(isSubmittedTooFast(null)).toBe(false);
    expect(isSubmittedTooFast(NaN)).toBe(false);
  });
});

describe("clientIpFromHeaders", () => {
  it("reads the first x-forwarded-for entry", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIpFromHeaders(h)).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(clientIpFromHeaders(h)).toBe("9.9.9.9");
  });
  it("returns 'unknown' when absent", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
