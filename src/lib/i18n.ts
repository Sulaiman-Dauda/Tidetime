/**
 * i18n foundation with full ICU MessageFormat support (plurals, select, number
 * and date formatting) via `intl-messageformat`. English is the source of truth
 * and fallback; every other locale lives in the community registry at
 * `src/i18n/messages.ts` and only needs the keys that differ from English.
 *
 * Add or improve a language by editing `src/i18n/messages.ts` (see
 * `src/i18n/README.md`) — it is auto-registered here, so browser negotiation,
 * the `t()` helper, and the locale picker all pick it up with no other change.
 *
 * A user/attendee's preferred locale comes from the `locale` column in the
 * schema, or is negotiated from the browser's Accept-Language header via
 * {@link negotiateLocale}.
 */

import { IntlMessageFormat } from "intl-messageformat";
import { messages } from "@/i18n/messages";

export const DEFAULT_LOCALE = "en";

/** A BCP-47 locale code we ship at least partial translations for. */
export type Locale = string;

/** Translation keys. Keeping these typed catches missing/renamed strings. */
export type TranslationKey =
  | "booking.confirmTitle"
  | "booking.confirmSubtitle"
  | "booking.yourName"
  | "booking.yourEmail"
  | "booking.submit"
  | "booking.submitting"
  | "booking.cancel"
  | "booking.reschedule"
  | "booking.cancelled"
  | "booking.pendingApproval"
  | "booking.tooManyAttempts"
  | "booking.genericError"
  | "email.confirmedSubject"
  | "email.cancelledSubject"
  | "common.poweredBy"
  // ICU plural examples — demonstrate count-aware messages.
  | "booking.guestCount"
  | "booking.seatsRemaining";

type Dictionary = Partial<Record<TranslationKey, string>>;

const en: Record<TranslationKey, string> = {
  "booking.confirmTitle": "Confirm your booking",
  "booking.confirmSubtitle": "Enter your details to finish booking.",
  "booking.yourName": "Your name",
  "booking.yourEmail": "Your email",
  "booking.submit": "Confirm booking",
  "booking.submitting": "Booking…",
  "booking.cancel": "Cancel",
  "booking.reschedule": "Reschedule",
  "booking.cancelled": "This booking has been cancelled.",
  "booking.pendingApproval": "Your booking is pending approval.",
  "booking.tooManyAttempts": "Too many attempts. Please try again later.",
  "booking.genericError": "We couldn't process that request. Please try again.",
  "email.confirmedSubject": "Your booking is confirmed",
  "email.cancelledSubject": "Your booking was cancelled",
  "common.poweredBy": "Powered by Tidetime",
  "booking.guestCount": "{count, plural, =0 {No guests} one {# guest} other {# guests}}",
  "booking.seatsRemaining": "{count, plural, =0 {Fully booked} one {# seat left} other {# seats left}}",
};

/**
 * Every shipped dictionary: English (the typed source) plus the community
 * registry. Missing keys in any locale fall back to English automatically.
 */
const dictionaries: Record<string, Dictionary> = { en, ...messages };

/** Canonical locale codes we ship, English first. */
export const SUPPORTED_LOCALES: readonly string[] = Object.keys(dictionaries);

/** Lower-cased code → canonical code, so matching is case- and region-aware. */
const LOWER_TO_CANON = new Map<string, string>(
  SUPPORTED_LOCALES.map((code) => [code.toLowerCase(), code]),
);

/** Type guard: is `value` a locale we ship (case-insensitive)? */
export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOWER_TO_CANON.has(value.toLowerCase());
}

/**
 * Normalize an arbitrary locale string (e.g. "en-US", "FR", "zh-TW") to a
 * canonical supported locale, falling back to the default. Prefers an exact
 * (region-aware) match, then the primary subtag.
 */
export function resolveLocale(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  const lower = value.toLowerCase();
  const exact = LOWER_TO_CANON.get(lower);
  if (exact) return exact;
  const primary = lower.split("-")[0]!;
  return LOWER_TO_CANON.get(primary) ?? DEFAULT_LOCALE;
}

/**
 * Negotiate the best supported locale from an HTTP `Accept-Language` header,
 * respecting q-weights. Falls back to the default. e.g.
 * "fr-CA,fr;q=0.9,en;q=0.8" → "fr".
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const weight = q ? Number(q.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.weight - a.weight);
  for (const { tag } of ranked) {
    const exact = LOWER_TO_CANON.get(tag);
    if (exact) return exact;
    const primary = LOWER_TO_CANON.get(tag.split("-")[0]!);
    if (primary) return primary;
  }
  return DEFAULT_LOCALE;
}

/** Compiled ICU message cache, keyed by `locale|template`. */
const formatCache = new Map<string, IntlMessageFormat>();

function formatMessage(
  locale: Locale,
  template: string,
  vars?: Record<string, string | number>,
): string {
  // Fast path: no ICU syntax, return verbatim (avoids parser overhead).
  if (!template.includes("{")) return template;
  const cacheKey = `${locale}|${template}`;
  let msg = formatCache.get(cacheKey);
  if (!msg) {
    try {
      msg = new IntlMessageFormat(template, locale);
      formatCache.set(cacheKey, msg);
    } catch {
      return template;
    }
  }
  try {
    return String(msg.format(vars));
  } catch {
    return template;
  }
}

/**
 * Translate `key` for `locale` with full ICU MessageFormat (interpolation,
 * plurals, select, number/date). Falls back to English, then to the key itself.
 */
export function t(
  locale: string | null | undefined,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const resolved = resolveLocale(locale);
  const template = dictionaries[resolved]?.[key] ?? en[key] ?? key;
  return formatMessage(resolved, template, vars);
}

/**
 * Bind a locale once and get a `t`-style function — convenient inside a request
 * or component scope: `const tr = getTranslator(user.locale); tr("booking.submit")`.
 */
export function getTranslator(locale: string | null | undefined) {
  const resolved = resolveLocale(locale);
  return (key: TranslationKey, vars?: Record<string, string | number>): string =>
    t(resolved, key, vars);
}
