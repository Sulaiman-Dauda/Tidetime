/**
 * Company-wide settings for a single-company Tidetime instance.
 *
 * Designed for an admin-driven configuration flow: one company, one admin who
 * configures global branding, booking availability and legal contents.
 * Values are persisted in the `app_settings` key/value table (see
 * {@link file://./../server/company-settings.ts}); this module is the pure,
 * testable core — types, defaults and merge/format helpers with no I/O.
 */

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface CompanyProfile {
  /** Displayed everywhere on the system. */
  name: string;
  /** Logo shown on the public booking page. */
  logoUrl: string;
  /** Brand colour applied across the app (hex, e.g. #4f46e5). */
  brandColor: string;
}

export interface CompanyBookingDefaults {
  /** When true the public booking page is disabled for everyone. */
  bookingDisabled: boolean;
  /** Require a privacy-friendly ALTCHA proof-of-work on the public booking form. */
  spamProtectionEnabled: boolean;
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
  booking: CompanyBookingDefaults;
  legal: CompanyLegalContents;
}

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                   */
/* -------------------------------------------------------------------------- */

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "Tidetime",
  logoUrl: "",
  brandColor: "#4f46e5",
};

export const DEFAULT_COMPANY_BOOKING: CompanyBookingDefaults = {
  bookingDisabled: false,
  spamProtectionEnabled: false,
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
  booking: "company_booking_defaults",
  legal: "company_legal_contents",
} as const;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Validate a hex colour, falling back to the brand default when invalid. */
export function normalizeBrandColor(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return HEX_COLOR.test(v) ? v : DEFAULT_COMPANY_PROFILE.brandColor;
}
