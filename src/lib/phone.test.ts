import { describe, expect, it } from "vitest";
import {
  DIALLING_COUNTRIES,
  countryFor,
  formatPhoneDisplay,
  isE164,
  normalizeDiallingCountry,
  splitE164,
  toE164,
} from "./phone";

describe("dialling country list", () => {
  it("is non-empty and uniquely keyed by ISO code", () => {
    const codes = DIALLING_COUNTRIES.map((c) => c.code);
    expect(codes.length).toBeGreaterThan(180);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has digits-only dialling codes", () => {
    for (const country of DIALLING_COUNTRIES) {
      expect(country.dial, country.code).toMatch(/^\d{1,4}$/);
    }
  });

  it("reads alphabetically so the picker needs no sorting", () => {
    const names = DIALLING_COUNTRIES.map((c) => c.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it("falls back to the UK for unknown or missing codes", () => {
    expect(normalizeDiallingCountry("ZZ")).toBe("GB");
    expect(normalizeDiallingCountry(null)).toBe("GB");
    expect(normalizeDiallingCountry("gb")).toBe("GB");
    expect(countryFor("nope").dial).toBe("44");
  });
});

describe("toE164", () => {
  it("normalises a UK national number, dropping the trunk zero", () => {
    expect(toE164("07700 900123", "GB")).toBe("+447700900123");
    expect(toE164("(01727) 123456", "GB")).toBe("+441727123456");
  });

  it("accepts a number that already carries its country code", () => {
    expect(toE164("+44 7700 900123", "GB")).toBe("+447700900123");
    // An explicit + wins over the selected country.
    expect(toE164("+1 555 123 4567", "GB")).toBe("+15551234567");
  });

  it("treats a 00 prefix as international", () => {
    expect(toE164("0044 7700 900123", "GB")).toBe("+447700900123");
  });

  it("uses the selected country for national input", () => {
    expect(toE164("612345678", "FR")).toBe("+33612345678");
    expect(toE164("0612345678", "FR")).toBe("+33612345678");
  });

  it("keeps the trunk zero for countries that dial it internationally", () => {
    // Italy keeps the leading zero: +39 06 ... is correct.
    expect(toE164("06 1234567", "IT")).toBe("+39061234567");
  });

  it("rejects text, empty input and implausible lengths", () => {
    expect(toE164("", "GB")).toBeNull();
    expect(toE164("   ", "GB")).toBeNull();
    expect(toE164("call me", "GB")).toBeNull();
    expect(toE164("07700 CALL", "GB")).toBeNull();
    // The old regex accepted this; six dashes is not a phone number.
    expect(toE164("------", "GB")).toBeNull();
    expect(toE164("123", "GB")).toBeNull();
    expect(toE164("0", "GB")).toBeNull();
    expect(toE164("+1234567890123456789", "GB")).toBeNull();
  });
});

describe("isE164", () => {
  it("accepts normalised numbers and rejects everything else", () => {
    expect(isE164("+447700900123")).toBe(true);
    expect(isE164("07700900123")).toBe(false);
    expect(isE164("+44 7700 900123")).toBe(false);
    expect(isE164("+123")).toBe(false);
  });
});

describe("splitE164", () => {
  it("recovers the country and national part", () => {
    expect(splitE164("+447700900123")).toEqual({ country: "GB", national: "7700900123" });
    expect(splitE164("+33612345678")).toEqual({ country: "FR", national: "612345678" });
  });

  it("prefers the longest matching dialling code", () => {
    // +1268 (Antigua) must beat the bare +1.
    expect(splitE164("+12684641234")?.country).toBe("AG");
  });

  it("uses the preferred country to break ties between equal codes", () => {
    // GB, JE, IM and GG all dial +44.
    expect(splitE164("+447700900123", "JE")?.country).toBe("JE");
    expect(splitE164("+447700900123")?.country).toBe("GB");
  });

  it("returns null for values that are not E.164", () => {
    expect(splitE164("07700900123")).toBeNull();
    expect(splitE164("not a number")).toBeNull();
  });

  it("round-trips with toE164", () => {
    const e164 = toE164("07700 900123", "GB")!;
    const parts = splitE164(e164)!;
    expect(toE164(parts.national, parts.country)).toBe(e164);
  });
});

describe("formatPhoneDisplay", () => {
  it("groups an E.164 number for reading", () => {
    expect(formatPhoneDisplay("+447700900123")).toBe("+44 7700 900123");
  });

  it("leaves legacy free-text answers untouched", () => {
    // Answers stored before normalisation existed must still render.
    expect(formatPhoneDisplay("01727 123456")).toBe("01727 123456");
    expect(formatPhoneDisplay("")).toBe("");
  });
});
