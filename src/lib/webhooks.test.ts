import { describe, it, expect } from "vitest";
import { isDeliverySuccess, nextDeliveryState } from "./webhooks";

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
    expect(s.nextAttemptAt.getTime()).toBe(now + 120_000);
  });

  it("gives up after max attempts", () => {
    const s = nextDeliveryState({ attempts: 5, maxAttempts: 5, ok: false, now });
    expect(s.status).toBe("failed");
  });
});
