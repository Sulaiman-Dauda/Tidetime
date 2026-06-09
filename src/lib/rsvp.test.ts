import { describe, it, expect } from "vitest";
import {
  isRsvpStatus,
  rsvpPartstat,
  rsvpToken,
  verifyRsvpToken,
  RSVP_STATUSES,
} from "./rsvp";

const SECRET = "test-secret-key";

describe("rsvp status helpers", () => {
  it("recognises valid statuses", () => {
    for (const s of RSVP_STATUSES) expect(isRsvpStatus(s)).toBe(true);
    expect(isRsvpStatus("needs_action")).toBe(false);
    expect(isRsvpStatus("maybe")).toBe(false);
    expect(isRsvpStatus(null)).toBe(false);
  });

  it("maps to iCalendar PARTSTAT", () => {
    expect(rsvpPartstat("accepted")).toBe("ACCEPTED");
    expect(rsvpPartstat("declined")).toBe("DECLINED");
    expect(rsvpPartstat("tentative")).toBe("TENTATIVE");
    expect(rsvpPartstat("needs_action")).toBe("NEEDS-ACTION");
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
