import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import { messages } from "./messages";
import { SUPPORTED_LOCALES, t, isSupportedLocale } from "@/lib/i18n";

/** The plural keys — exercised across several counts to catch bad ICU. */
const PLURAL_KEYS = ["booking.guestCount", "booking.seatsRemaining"] as const;

describe("community message registry", () => {
  it("ships 30+ locales", () => {
    // en (source) + the registry.
    expect(SUPPORTED_LOCALES.length).toBeGreaterThanOrEqual(30);
  });

  it("registers every locale as supported", () => {
    for (const code of Object.keys(messages)) {
      expect(isSupportedLocale(code)).toBe(true);
    }
  });

  it("every template in every locale is valid ICU", () => {
    for (const [locale, dict] of Object.entries(messages)) {
      for (const [key, template] of Object.entries(dict)) {
        if (typeof template !== "string") continue;
        // Throws on malformed ICU (e.g. unbalanced braces, bad plural syntax).
        expect(() => new IntlMessageFormat(template, locale), `${locale} / ${key}`).not.toThrow();
      }
    }
  });

  it("renders plural keys for 0/1/2/5 in every locale without throwing", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of PLURAL_KEYS) {
        for (const count of [0, 1, 2, 5]) {
          const out = t(locale, key, { count });
          expect(typeof out, `${locale} / ${key} / ${count}`).toBe("string");
          expect(out.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
