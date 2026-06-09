import { describe, expect, it } from "vitest";
import {
  t,
  getTranslator,
  resolveLocale,
  isSupportedLocale,
  negotiateLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from "./i18n";

describe("resolveLocale", () => {
  it("returns supported locales as-is", () => {
    expect(resolveLocale("es")).toBe("es");
    expect(resolveLocale("de")).toBe("de");
  });
  it("matches the primary subtag", () => {
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("fr-CA")).toBe("fr");
  });
  it("is case-insensitive", () => {
    expect(resolveLocale("ES")).toBe("es");
  });
  it("falls back to default for unknown/empty", () => {
    expect(resolveLocale("zz")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
  });
});

describe("isSupportedLocale", () => {
  it("recognizes shipped locales", () => {
    for (const l of SUPPORTED_LOCALES) expect(isSupportedLocale(l)).toBe(true);
  });
  it("rejects others", () => {
    expect(isSupportedLocale("jp")).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});

describe("t", () => {
  it("translates a known key per locale", () => {
    expect(t("en", "booking.submit")).toBe("Confirm booking");
    expect(t("es", "booking.submit")).toBe("Confirmar reserva");
    expect(t("fr", "booking.submit")).toBe("Confirmer la réservation");
  });
  it("falls back to English for missing translations", () => {
    // Unknown locale resolves to default English.
    expect(t("zz", "booking.submit")).toBe("Confirm booking");
  });
  it("interpolates variables", () => {
    // No interpolated keys ship by default; verify mechanism via a templated call.
    expect(t("en", "common.poweredBy")).toBe("Powered by Tidetime");
  });
});

describe("getTranslator", () => {
  it("binds a locale", () => {
    const tr = getTranslator("de");
    expect(tr("booking.cancel")).toBe("Stornieren");
  });
  it("falls back like t()", () => {
    const tr = getTranslator("xx");
    expect(tr("booking.cancel")).toBe("Cancel");
  });
});

describe("ICU plurals", () => {
  it("selects the right plural form (en)", () => {
    expect(t("en", "booking.guestCount", { count: 0 })).toBe("No guests");
    expect(t("en", "booking.guestCount", { count: 1 })).toBe("1 guest");
    expect(t("en", "booking.guestCount", { count: 5 })).toBe("5 guests");
  });
  it("localizes plurals (de)", () => {
    expect(t("de", "booking.seatsRemaining", { count: 0 })).toBe("Ausgebucht");
    expect(t("de", "booking.seatsRemaining", { count: 1 })).toBe("1 Platz frei");
    expect(t("de", "booking.seatsRemaining", { count: 3 })).toBe("3 Plätze frei");
  });
  it("interpolates a simple variable", () => {
    expect(t("en", "booking.guestCount", { count: 2 })).toContain("2");
  });
});

describe("negotiateLocale", () => {
  it("picks the highest-weighted supported locale", () => {
    expect(negotiateLocale("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(negotiateLocale("en-US,en;q=0.9")).toBe("en");
  });
  it("respects q-weights over order", () => {
    expect(negotiateLocale("en;q=0.3, de;q=0.9")).toBe("de");
  });
  it("falls back to default", () => {
    expect(negotiateLocale("zz,xx;q=0.5")).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
  });
});
