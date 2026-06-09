import "server-only";
import { crmApps } from "./registry";
import { isFeatureEnabled } from "@/server/feature-flags";
import type { CrmBookingEvent } from "./types";

/**
 * Fan a new booking out to every CRM app the host has connected. Best-effort and
 * fully isolated: a failing or unconfigured CRM never affects the booking. No-op
 * unless the instance has opted into the CRM feature.
 */
export async function runCrmBookingCreated(
  userId: number,
  event: CrmBookingEvent,
): Promise<void> {
  if (!(await isFeatureEnabled("crm"))) return;
  const apps = crmApps();
  if (apps.length === 0) return;
  await Promise.allSettled(
    apps.map(async (a) => {
      if (!(await a.isConfigured().catch(() => false))) return;
      if (!(await a.isInstalled(userId).catch(() => false))) return;
      await a.crm!.onBookingCreated(userId, event);
    }),
  );
}
