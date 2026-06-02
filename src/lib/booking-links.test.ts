import { describe, it, expect } from "vitest";
import { validateBookingLink, type BookingLinkState } from "./booking-links";

const now = new Date("2026-06-01T12:00:00.000Z");

function link(p: Partial<BookingLinkState>): BookingLinkState {
  return {
    kind: "one_time",
    maxUses: null,
    usedCount: 0,
    expiresAt: null,
    inviteEmail: null,
    revoked: false,
    ...p,
  };
}

describe("validateBookingLink", () => {
  it("accepts a fresh one-time link", () => {
    expect(validateBookingLink(link({ kind: "one_time" }), now)).toEqual({ ok: true });
  });

  it("rejects a used one-time link", () => {
    expect(validateBookingLink(link({ kind: "one_time", usedCount: 1 }), now)).toEqual({
      ok: false,
      reason: "exhausted",
    });
  });

  it("rejects a revoked link", () => {
    expect(validateBookingLink(link({ revoked: true }), now)).toEqual({
      ok: false,
      reason: "revoked",
    });
  });

  it("rejects an expired link", () => {
    expect(
      validateBookingLink(link({ kind: "expiring", expiresAt: new Date("2026-05-30T00:00:00Z") }), now),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts an expiring link that is still valid", () => {
    expect(
      validateBookingLink(link({ kind: "expiring", expiresAt: new Date("2026-06-02T00:00:00Z") }), now),
    ).toEqual({ ok: true });
  });

  it("enforces limited-use counts", () => {
    expect(validateBookingLink(link({ kind: "limited", maxUses: 3, usedCount: 2 }), now)).toEqual({
      ok: true,
    });
    expect(validateBookingLink(link({ kind: "limited", maxUses: 3, usedCount: 3 }), now)).toEqual({
      ok: false,
      reason: "exhausted",
    });
  });

  it("locks invite links to the invited email", () => {
    const l = link({ kind: "invite", inviteEmail: "vip@acme.com" });
    expect(validateBookingLink(l, now, "vip@acme.com")).toEqual({ ok: true });
    expect(validateBookingLink(l, now, "VIP@ACME.COM")).toEqual({ ok: true });
    expect(validateBookingLink(l, now, "someone@else.com")).toEqual({
      ok: false,
      reason: "wrong_invitee",
    });
    expect(validateBookingLink(l, now)).toEqual({ ok: false, reason: "wrong_invitee" });
  });
});
