import { describe, it, expect } from "vitest";
import {
  DEFAULT_COMPANY_BOOKING,
  DEFAULT_COMPANY_PROFILE,
  mergeWithDefaults,
  normalizeBrandColor,
} from "./company-settings";

describe("mergeWithDefaults", () => {
  it("returns a copy of defaults when stored is not an object", () => {
    expect(mergeWithDefaults(DEFAULT_COMPANY_PROFILE, null)).toEqual(DEFAULT_COMPANY_PROFILE);
    expect(mergeWithDefaults(DEFAULT_COMPANY_PROFILE, "nope")).toEqual(DEFAULT_COMPANY_PROFILE);
    expect(mergeWithDefaults(DEFAULT_COMPANY_PROFILE, 42)).toEqual(DEFAULT_COMPANY_PROFILE);
  });

  it("overrides only matching keys and ignores unknown keys", () => {
    const merged = mergeWithDefaults(DEFAULT_COMPANY_PROFILE, {
      name: "Acme",
      bogus: "x",
    });
    expect(merged.name).toBe("Acme");
    expect(merged.brandColor).toBe(DEFAULT_COMPANY_PROFILE.brandColor);
    expect("bogus" in merged).toBe(false);
  });

  it("ignores type-mismatched values", () => {
    const merged = mergeWithDefaults(DEFAULT_COMPANY_BOOKING, {
      bookingDisabled: "yes",
      spamProtectionEnabled: true,
    });
    expect(merged.bookingDisabled).toBe(DEFAULT_COMPANY_BOOKING.bookingDisabled);
    expect(merged.spamProtectionEnabled).toBe(true);
  });

  it("does not mutate the defaults object", () => {
    const before = { ...DEFAULT_COMPANY_PROFILE };
    mergeWithDefaults(DEFAULT_COMPANY_PROFILE, { name: "Mutated" });
    expect(DEFAULT_COMPANY_PROFILE).toEqual(before);
  });
});

describe("normalizeBrandColor", () => {
  it("accepts 3 and 6 digit hex", () => {
    expect(normalizeBrandColor("#abc")).toBe("#abc");
    expect(normalizeBrandColor("#A1B2C3")).toBe("#A1B2C3");
  });

  it("falls back to the default on invalid input", () => {
    expect(normalizeBrandColor("blue")).toBe(DEFAULT_COMPANY_PROFILE.brandColor);
    expect(normalizeBrandColor("")).toBe(DEFAULT_COMPANY_PROFILE.brandColor);
    expect(normalizeBrandColor(null)).toBe(DEFAULT_COMPANY_PROFILE.brandColor);
  });
});
