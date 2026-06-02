import { describe, it, expect } from "vitest";
import { computeCharge, computeRefund, mapStripeStatus } from "./payments";

describe("computeCharge", () => {
  it("returns null for a free event", () => {
    expect(computeCharge({ price: 0, depositAmount: 0, currency: "usd" })).toBeNull();
  });

  it("charges the full price when no deposit is set", () => {
    expect(computeCharge({ price: 5000, depositAmount: 0, currency: "usd" })).toEqual({
      amount: 5000,
      currency: "usd",
      isDeposit: false,
      balanceDue: 0,
    });
  });

  it("charges a deposit and tracks the remaining balance", () => {
    expect(computeCharge({ price: 10000, depositAmount: 2500, currency: "eur" })).toEqual({
      amount: 2500,
      currency: "eur",
      isDeposit: true,
      balanceDue: 7500,
    });
  });

  it("collapses a deposit >= price into a full charge", () => {
    expect(computeCharge({ price: 4000, depositAmount: 4000, currency: "usd" })).toEqual({
      amount: 4000,
      currency: "usd",
      isDeposit: false,
      balanceDue: 0,
    });
  });
});

describe("computeRefund", () => {
  it("defaults to a full refund", () => {
    expect(computeRefund(5000)).toBe(5000);
  });

  it("honours a partial refund within bounds", () => {
    expect(computeRefund(5000, 2000)).toBe(2000);
  });

  it("clamps an over-refund to the paid amount", () => {
    expect(computeRefund(5000, 9999)).toBe(5000);
  });

  it("never returns a negative refund", () => {
    expect(computeRefund(5000, -100)).toBe(0);
    expect(computeRefund(0)).toBe(0);
  });
});

describe("mapStripeStatus", () => {
  it("maps succeeded to paid", () => {
    expect(mapStripeStatus("succeeded")).toBe("paid");
  });
  it("maps canceled to failed", () => {
    expect(mapStripeStatus("canceled")).toBe("failed");
  });
  it("maps in-flight states to pending", () => {
    expect(mapStripeStatus("processing")).toBe("pending");
    expect(mapStripeStatus("requires_action")).toBe("pending");
    expect(mapStripeStatus("unknown_future_state")).toBe("pending");
  });
});
