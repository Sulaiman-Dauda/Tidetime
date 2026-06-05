/**
 * Company-wide settings for a single-company Tidetime instance.
 *
 * Designed for an admin-driven configuration flow: one company, one admin who
 * configures global branding, localization, business logic and legal contents.
 * Values are persisted in the `app_settings` key/value table (see
 * {@link file://./../server/company-settings.ts}); this module is the pure,
 * testable core — types, defaults and merge/format helpers with no I/O.
 */

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type DateFormat = "DMY" | "MDY" | "YMD";

export interface CompanyProfile {
  /** Displayed everywhere on the system. */
  name: string;
  /** Reply-to / sender address for system emails. */
  email: string;
  /** Official company website. */
  websiteUrl: string;
  /** Logo shown on the booking page and emails. */
  logoUrl: string;
  /** Brand colour applied across the app (hex, e.g. #4f46e5). */
  brandColor: string;
}

export interface CompanyLocalization {
  dateFormat: DateFormat;
  /** 12 or 24 hour clock. */
  timeFormat: 12 | 24;
  /** 0 = Sunday … 6 = Saturday. */
  weekStart: number;
  defaultLocale: string;
  defaultTimeZone: string;
}

export interface CompanyBookingDefaults {
  /** How many days ahead customers may book. */
  futureBookingLimitDays: number;
  /** Lead time (minutes) before a slot can be booked. */
  minimumBookingNoticeMinutes: number;
  /** Cut-off (minutes) before the start within which reschedule/cancel is blocked. */
  rescheduleCancelTimeoutMinutes: number;
  /** When true the public booking page is disabled for everyone. */
  bookingDisabled: boolean;
  /** Available appointment status labels; first is the default. */
  appointmentStatuses: string[];
}

export interface CompanyLegalContents {
  cookieNoticeEnabled: boolean;
  cookieNoticeContent: string;
  termsEnabled: boolean;
  termsContent: string;
  privacyEnabled: boolean;
  privacyContent: string;
  legalNoticeUrl: string;
  imprintUrl: string;
  /** Days after which customer data is auto-deleted; 0 disables. */
  dataRetentionDays: number;
}

export interface CompanySettings {
  profile: CompanyProfile;
  localization: CompanyLocalization;
  booking: CompanyBookingDefaults;
  legal: CompanyLegalContents;
}

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "Tidetime",
  email: "",
  websiteUrl: "",
  logoUrl: "",
  brandColor: "#4f46e5",
};

export const DEFAULT_COMPANY_LOCALIZATION: CompanyLocalization = {
  dateFormat: "DMY",
  timeFormat: 12,
  weekStart: 1,
  defaultLocale: "en",
  defaultTimeZone: "UTC",
};

export const DEFAULT_COMPANY_BOOKING: CompanyBookingDefaults = {
  futureBookingLimitDays: 90,
  minimumBookingNoticeMinutes: 120,
  rescheduleCancelTimeoutMinutes: 30,
  bookingDisabled: false,
  appointmentStatuses: ["Booked", "Confirmed", "Rescheduled", "Cancelled", "Draft"],
};

export const DEFAULT_COMPANY_LEGAL: CompanyLegalContents = {
  cookieNoticeEnabled: false,
  cookieNoticeContent: "",
  termsEnabled: false,
  termsContent: "",
  privacyEnabled: false,
  privacyContent: "",
  legalNoticeUrl: "",
  imprintUrl: "",
  dataRetentionDays: 0,
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  profile: DEFAULT_COMPANY_PROFILE,
  localization: DEFAULT_COMPANY_LOCALIZATION,
  booking: DEFAULT_COMPANY_BOOKING,
  legal: DEFAULT_COMPANY_LEGAL,
};

/* -------------------------------------------------------------------------- */
/*  Merge helpers (fill missing keys from defaults, ignore unknown ones)       */
/* -------------------------------------------------------------------------- */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Merge a stored partial value over a defaults object, key by key. */
export function mergeWithDefaults<T extends object>(
  defaults: T,
  stored: unknown,
): T {
  if (!isObject(stored)) return { ...defaults };
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const v = stored[key as string];
    if (v === undefined || v === null) continue;
    const def = defaults[key];
    // Only accept values whose primitive/array shape matches the default.
    if (Array.isArray(def)) {
      if (Array.isArray(v)) out[key] = v as T[keyof T];
    } else if (typeof def === typeof v) {
      out[key] = v as T[keyof T];
    }
  }
  return out;
}

export const COMPANY_SETTING_KEYS = {
  profile: "company_profile",
  localization: "company_localization",
  booking: "company_booking_defaults",
  legal: "company_legal_contents",
} as const;

/* -------------------------------------------------------------------------- */
/*  Formatting helpers                                                         */
/* -------------------------------------------------------------------------- */

const DATE_FORMAT_PATTERNS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  DMY: { day: "2-digit", month: "2-digit", year: "numeric" },
  MDY: { month: "2-digit", day: "2-digit", year: "numeric" },
  YMD: { year: "numeric", month: "2-digit", day: "2-digit" },
};

/** Resolve the Intl options for a configured date format. */
export function dateFormatOptions(format: DateFormat): Intl.DateTimeFormatOptions {
  return DATE_FORMAT_PATTERNS[format] ?? DATE_FORMAT_PATTERNS.DMY;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Validate a hex colour, falling back to the brand default when invalid. */
export function normalizeBrandColor(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return HEX_COLOR.test(v) ? v : DEFAULT_COMPANY_PROFILE.brandColor;
}
