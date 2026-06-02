import { describe, it, expect } from "vitest";
import {
  nextBackoffMs,
  isDeliverySuccess,
  nextDeliveryState,
  WEBHOOK_BASE_DELAY_MS,
  WEBHOOK_MAX_DELAY_MS,
} from "./webhooks";

describe("nextBackoffMs", () => {
  it("returns the base delay for the first retry", () => {
    expect(nextBackoffMs(1)).toBe(WEBHOOK_BASE_DELAY_MS);
  });

  it("doubles with each attempt", () => {
    expect(nextBackoffMs(2)).toBe(WEBHOOK_BASE_DELAY_MS * 2);
    expect(nextBackoffMs(3)).toBe(WEBHOOK_BASE_DELAY_MS * 4);
  });

  it("caps at the maximum delay", () => {
    expect(nextBackoffMs(100)).toBe(WEBHOOK_MAX_DELAY_MS);
  });

  it("handles non-positive attempts", () => {
    expect(nextBackoffMs(0)).toBe(WEBHOOK_BASE_DELAY_MS);
  });
});

describe("isDeliverySuccess", () => {
  it("treats 2xx as success", () => {
    expect(isDeliverySuccess(200)).toBe(true);
    expect(isDeliverySuccess(204)).toBe(true);
  });
  it("treats non-2xx as failure", () => {
    expect(isDeliverySuccess(301)).toBe(false);
    expect(isDeliverySuccess(404)).toBe(false);
    expect(isDeliverySuccess(500)).toBe(false);
  });
});

describe("nextDeliveryState", () => {
  const now = 1_000_000;

  it("marks success immediately when ok", () => {
    const s = nextDeliveryState({ attempts: 1, maxAttempts: 5, ok: true, now });
    expect(s.status).toBe("success");
  });

  it("schedules a retry with backoff on failure", () => {
    const s = nextDeliveryState({ attempts: 2, maxAttempts: 5, ok: false, now });
    expect(s.status).toBe("pending");
    expect(s.nextAttemptAt.getTime()).toBe(now + nextBackoffMs(2));
  });

  it("gives up after max attempts", () => {
    const s = nextDeliveryState({ attempts: 5, maxAttempts: 5, ok: false, now });
    expect(s.status).toBe("failed");
  });
});
