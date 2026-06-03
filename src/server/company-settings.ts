import "server-only";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { cache } from "react";
import {
  COMPANY_SETTING_KEYS,
  DEFAULT_COMPANY_BOOKING,
  DEFAULT_COMPANY_LEGAL,
  DEFAULT_COMPANY_LOCALIZATION,
  DEFAULT_COMPANY_PROFILE,
  mergeWithDefaults,
  normalizeBrandColor,
  type CompanyBookingDefaults,
  type CompanyLegalContents,
  type CompanyLocalization,
  type CompanyProfile,
  type CompanySettings,
} from "@/lib/company-settings";

/**
 * Admin-configured, company-wide settings persisted in the `app_settings`
 * key/value table. Each section is stored under its own key so partial updates
 * never clobber unrelated config.
 */

const ALL_KEYS = Object.values(COMPANY_SETTING_KEYS);

/**
 * Load every company-settings section in one query and merge each over its
 * defaults. Cached per-request via React `cache` so layouts/pages that all need
 * branding don't issue duplicate queries.
 */
export const getCompanySettings = cache(async (): Promise<CompanySettings> => {
  const rows = await db
    .select({ name: appSettings.name, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.name, ALL_KEYS));

  const byKey = new Map(rows.map((r) => [r.name, r.value]));
  const profile = mergeWithDefaults(
    DEFAULT_COMPANY_PROFILE,
    byKey.get(COMPANY_SETTING_KEYS.profile),
  );
  profile.brandColor = normalizeBrandColor(profile.brandColor);

  return {
    profile,
    localization: mergeWithDefaults(
      DEFAULT_COMPANY_LOCALIZATION,
      byKey.get(COMPANY_SETTING_KEYS.localization),
    ),
    booking: mergeWithDefaults(
      DEFAULT_COMPANY_BOOKING,
      byKey.get(COMPANY_SETTING_KEYS.booking),
    ),
    legal: mergeWithDefaults(DEFAULT_COMPANY_LEGAL, byKey.get(COMPANY_SETTING_KEYS.legal)),
  };
});

async function writeSetting(name: string, value: unknown): Promise<void> {
  await db
    .insert(appSettings)
    .values({ name, value: value as Record<string, unknown> })
    .onConflictDoUpdate({ target: appSettings.name, set: { value: value as Record<string, unknown> } });
}

export function setCompanyProfile(profile: CompanyProfile): Promise<void> {
  return writeSetting(COMPANY_SETTING_KEYS.profile, {
    ...profile,
    brandColor: normalizeBrandColor(profile.brandColor),
  });
}

export function setCompanyLocalization(localization: CompanyLocalization): Promise<void> {
  return writeSetting(COMPANY_SETTING_KEYS.localization, localization);
}

export function setCompanyBookingDefaults(booking: CompanyBookingDefaults): Promise<void> {
  return writeSetting(COMPANY_SETTING_KEYS.booking, booking);
}

export function setCompanyLegalContents(legal: CompanyLegalContents): Promise<void> {
  return writeSetting(COMPANY_SETTING_KEYS.legal, legal);
}
