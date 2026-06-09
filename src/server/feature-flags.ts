import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

/**
 * Instance-level feature flags for the heavier "business" capabilities.
 *
 * Tidetime's promise is a 5-minute setup for the solo Calendly switcher, so the
 * power features that only multi-provider businesses (clinics, salons, agencies)
 * need are **off by default** — they stay out of the default product entirely
 * (no nav item, no booking-time work, no integration card) until an admin turns
 * them on. This is a lean-by-default toggle, not a paywall: every flag is free
 * to enable, consistent with the Community edition being fully functional.
 *
 *  - `crm`        CRM sync (HubSpot, …) on each booking.
 */

const SETTING_KEY = "feature_flags";

export type FeatureFlag = "crm";

export interface FeatureFlags {
  crm: boolean;
}

const DEFAULTS: FeatureFlags = { crm: false };

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, SETTING_KEY))
    .limit(1);
  const stored = (row?.value ?? null) as Partial<FeatureFlags> | null;
  if (!stored) return { ...DEFAULTS };
  return {
    crm: Boolean(stored.crm),
  };
}

export async function isFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  return (await getFeatureFlags())[flag];
}

export async function setFeatureFlag(flag: FeatureFlag, enabled: boolean): Promise<void> {
  const current = await getFeatureFlags();
  const next: FeatureFlags = { ...current, [flag]: enabled };
  await db
    .insert(appSettings)
    .values({ name: SETTING_KEY, value: next })
    .onConflictDoUpdate({ target: appSettings.name, set: { value: next } });
}
