import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  calendarCache,
  services,
  sessions,
  verificationTokens,
  webhookDeliveries,
} from "@/db/schema";
import { getCompanySettings } from "./company-settings";

/**
 * GDPR-friendly data-retention cleanup. Two tiers:
 *  - Operational hygiene (always): purge expired sessions, verification tokens,
 *    stale busy-time cache, abandoned service drafts, and old delivered/failed
 *    webhook deliveries.
 *  - Personal-data retention (opt-in via Settings → Legal "data retention days"):
 *    permanently delete bookings — and their cascading attendees, references,
 *    activity and calendar references — once they're older than the window.
 *
 * Runs from the same job runner as webhook delivery.
 */

/** Abandoned service drafts older than this are removed. */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
/** Resolved webhook deliveries are retained this long for debugging. */
const WEBHOOK_DELIVERY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface RetentionSummary {
  sessions: number;
  verificationTokens: number;
  calendarCache: number;
  draftServices: number;
  webhookDeliveries: number;
  bookings: number;
}

/**
 * The cutoff before which personal data should be purged, or null when the
 * retention window is disabled (days <= 0). Pure — unit tested.
 */
export function retentionCutoff(days: number, now = new Date()): Date | null {
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function runRetentionCleanup(now = new Date()): Promise<RetentionSummary> {
  const summary: RetentionSummary = {
    sessions: 0,
    verificationTokens: 0,
    calendarCache: 0,
    draftServices: 0,
    webhookDeliveries: 0,
    bookings: 0,
  };

  // --- Operational hygiene (always) -------------------------------------------
  summary.sessions = (
    await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.id })
  ).length;

  summary.verificationTokens = (
    await db
      .delete(verificationTokens)
      .where(lt(verificationTokens.expiresAt, now))
      .returning({ id: verificationTokens.id })
  ).length;

  summary.calendarCache = (
    await db
      .delete(calendarCache)
      .where(lt(calendarCache.expiresAt, now))
      .returning({ id: calendarCache.id })
  ).length;

  summary.draftServices = (
    await db
      .delete(services)
      .where(
        and(eq(services.draft, true), lt(services.createdAt, new Date(now.getTime() - DRAFT_TTL_MS))),
      )
      .returning({ id: services.id })
  ).length;

  summary.webhookDeliveries = (
    await db
      .delete(webhookDeliveries)
      .where(
        and(
          inArray(webhookDeliveries.status, ["success", "failed"]),
          lt(webhookDeliveries.createdAt, new Date(now.getTime() - WEBHOOK_DELIVERY_TTL_MS)),
        ),
      )
      .returning({ id: webhookDeliveries.id })
  ).length;

  // --- Personal-data retention (opt-in) ---------------------------------------
  const settings = await getCompanySettings();
  const cutoff = retentionCutoff(settings.legal.dataRetentionDays, now);
  if (cutoff) {
    summary.bookings = (
      await db.delete(bookings).where(lt(bookings.endTime, cutoff)).returning({ id: bookings.id })
    ).length;
  }

  return summary;
}
