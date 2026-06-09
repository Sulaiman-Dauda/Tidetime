import "server-only";
import { calendarAdapters, getAdapter } from "@/server/calendar";
import { isGoogleConfigured } from "@/server/google-calendar";
import { isMicrosoftConfigured } from "@/server/calendar/microsoft";
import { dailyApp } from "./daily";
import { zoomApp } from "./zoom";
import { msTeamsApp } from "./msteams";
import { hubspotApp } from "./hubspot";
import { appMeta, type AppDefinition } from "./types";

/* -------------------------------------------------------------------------- */
/*  Calendar apps (delegate to the existing calendar adapters)                  */
/* -------------------------------------------------------------------------- */

function calendarConfigured(integration: string): Promise<boolean> {
  switch (integration) {
    case "google_calendar":
      return isGoogleConfigured();
    case "office365_calendar":
      return isMicrosoftConfigured();
    case "caldav_calendar":
      return Promise.resolve(true); // user-supplied server URL + credentials, no env needed
    default:
      return Promise.resolve(true);
  }
}

const calendarApps: AppDefinition[] = calendarAdapters.map((adapter) => ({
  meta: appMeta(adapter.integration)!,
  isConfigured: () => calendarConfigured(adapter.integration),
  isInstalled: (userId) => adapter.isConnected(userId),
  uninstall: (userId) => adapter.disconnect(userId),
}));

/* -------------------------------------------------------------------------- */
/*  Full registry                                                               */
/* -------------------------------------------------------------------------- */

/** Every registered app, in display order. Calendars first, then video, CRM. */
export const apps: AppDefinition[] = [
  ...calendarApps,
  dailyApp,
  zoomApp,
  msTeamsApp,
  hubspotApp,
];

export function getApp(slug: string): AppDefinition | undefined {
  return apps.find((a) => a.meta.slug === slug);
}

/** Apps that mint their own meeting links (have a VideoApp). */
export function videoApps(): AppDefinition[] {
  return apps.filter((a) => a.video);
}

/** Apps that record bookings into a CRM. */
export function crmApps(): AppDefinition[] {
  return apps.filter((a) => a.crm);
}

export interface AppStatus {
  slug: string;
  name: string;
  category: AppDefinition["meta"]["category"];
  description: string;
  publisher: string;
  icon: string;
  docsUrl?: string;
  configured: boolean;
  installed: boolean;
  /** true when the app exposes a generic OAuth install URL */
  installable: boolean;
  /** calendars are connected from Settings → Calendar, not the generic flow */
  settingsManaged: boolean;
}

/** Resolve display + connection status for every app for a given user. */
export async function getAppStatuses(userId: number): Promise<AppStatus[]> {
  return Promise.all(
    apps.map(async (a) => ({
      slug: a.meta.slug,
      name: a.meta.name,
      category: a.meta.category,
      description: a.meta.description,
      publisher: a.meta.publisher,
      icon: a.meta.icon,
      docsUrl: a.meta.docsUrl,
      configured: await a.isConfigured().catch(() => false),
      installed: await a.isInstalled(userId).catch(() => false),
      installable: Boolean(a.getInstallUrl),
      settingsManaged: a.meta.category === "calendar",
    })),
  );
}

/**
 * Video location types the user can actually offer right now (provider connected
 * + configured). Drives the event-type editor's location picker so we never show
 * a video option that would silently produce no link.
 */
export async function getAvailableVideoLocations(
  userId: number,
): Promise<{ type: string; label: string }[]> {
  // Built-in Jitsi needs no provider connection, so it's always offered.
  const out: { type: string; label: string }[] = [{ type: "jitsi", label: "Jitsi Meet (built-in)" }];
  for (const a of apps) {
    if (a.meta.category !== "video" || !a.meta.locationType) continue;
    if (!(await a.isConfigured().catch(() => false))) continue;
    if (!(await a.isInstalled(userId).catch(() => false))) continue;
    out.push({ type: a.meta.locationType, label: a.meta.name });
  }
  return out;
}

export { getAdapter };
