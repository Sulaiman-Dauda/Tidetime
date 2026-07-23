import { describe, it, expect } from "vitest";
import {
  isRsvpStatus,
  rsvpToken,
  verifyRsvpToken,
} from "./rsvp";

const SECRET = "test-secret-key";

describe("rsvp status helpers", () => {
  it("recognises valid statuses", () => {
    for (const status of ["accepted", "declined", "tentative"]) {
      expect(isRsvpStatus(status)).toBe(true);
    }
    expect(isRsvpStatus("needs_action")).toBe(false);
    expect(isRsvpStatus("maybe")).toBe(false);
    expect(isRsvpStatus(null)).toBe(false);
  });
});

describe("rsvp token signing", () => {
  it("is deterministic and verifies", () => {
    const t = rsvpToken("bk_123", "Jane@Example.com", SECRET);
    expect(t).toBe(rsvpToken("bk_123", "jane@example.com", SECRET)); // email normalised
    expect(verifyRsvpToken("bk_123", "jane@example.com", t, SECRET)).toBe(true);
  });

  it("is bound to booking + email", () => {
    const t = rsvpToken("bk_123", "jane@example.com", SECRET);
    expect(verifyRsvpToken("bk_999", "jane@example.com", t, SECRET)).toBe(false);
    expect(verifyRsvpToken("bk_123", "bob@example.com", t, SECRET)).toBe(false);
  });

  it("rejects tampered tokens and wrong secrets", () => {
    const t = rsvpToken("bk_123", "jane@example.com", SECRET);
    expect(verifyRsvpToken("bk_123", "jane@example.com", t + "x", SECRET)).toBe(false);
    expect(verifyRsvpToken("bk_123", "jane@example.com", t, "other-secret")).toBe(false);
  });
});
