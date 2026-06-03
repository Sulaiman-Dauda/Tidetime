import { describe, it, expect } from "vitest";
import {
  DEFAULT_COMPANY_BOOKING,
  DEFAULT_COMPANY_PROFILE,
  dateFormatOptions,
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
      futureBookingLimitDays: "lots",
      minimumBookingNoticeMinutes: 30,
    });
    expect(merged.futureBookingLimitDays).toBe(DEFAULT_COMPANY_BOOKING.futureBookingLimitDays);
    expect(merged.minimumBookingNoticeMinutes).toBe(30);
  });

  it("accepts array overrides", () => {
    const merged = mergeWithDefaults(DEFAULT_COMPANY_BOOKING, {
      appointmentStatuses: ["A", "B"],
    });
    expect(merged.appointmentStatuses).toEqual(["A", "B"]);
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

describe("dateFormatOptions", () => {
  it("maps each format to Intl options", () => {
    expect(dateFormatOptions("DMY")).toMatchObject({ day: "2-digit" });
    expect(dateFormatOptions("MDY")).toMatchObject({ month: "2-digit" });
    expect(dateFormatOptions("YMD")).toMatchObject({ year: "numeric" });
  });
});
