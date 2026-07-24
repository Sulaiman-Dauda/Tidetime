import "server-only";
import { readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { RUNNING_VERSION, SOURCE_REPO, normalizeVersion, compareVersions } from "@/lib/version";

/**
 * Self-update support for Docker deployments.
 *
 * We compare the running version (RUNNING_VERSION, from package.json, baked into
 * the image) against the latest published GitHub release. When a newer release
 * exists, admins see an update prompt. Performing the update needs Docker
 * access, which the app deliberately does not have, so it hands off to an
 * optional `updater` sidecar (docker-compose.updater.yml) through a shared
 * volume. When that sidecar is not running, the dashboard shows the manual
 * command instead.
 */

const CACHE_KEY = "system:update_check";
const CACHE_TTL_MS = 30 * 60 * 1000;
const GITHUB_TIMEOUT_MS = 8_000;

// Shared volume the app and the updater sidecar use to talk. The app only ever
// writes a request and reads the heartbeat/status; it never touches Docker.
const UPDATE_DIR = process.env.TIDETIME_UPDATE_DIR || "/var/run/tidetime";
const HEARTBEAT_MAX_AGE_MS = 30_000;
const F_HEARTBEAT = join(UPDATE_DIR, "heartbeat");
const F_REQUEST = join(UPDATE_DIR, "update.request");
const F_STATUS = join(UPDATE_DIR, "update.status");

export interface UpdateStatus {
  /** Running app version, e.g. "0.1.0". */
  version: string;
  /** Latest released version, e.g. "0.1.1", or null when unknown. */
  latestVersion: string | null;
  updateAvailable: boolean;
  checkedAt: string | null;
  /** Link to the latest release's notes. */
  releaseUrl: string | null;
  /** Whether the optional updater sidecar is running (one-click possible). */
  updaterAvailable: boolean;
  /** "running" | "done" | "failed" while/after an update, else null. */
  progress: string | null;
}

interface CacheValue {
  version: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  checkedAt: string;
}

async function readCache(): Promise<CacheValue | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, CACHE_KEY))
    .limit(1);
  return (row?.value as CacheValue | undefined) ?? null;
}

async function writeCache(value: CacheValue): Promise<void> {
  await db
    .insert(appSettings)
    .values({ name: CACHE_KEY, value: value as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: appSettings.name,
      set: { value: value as unknown as Record<string, unknown> },
    });
}

async function fetchLatestRelease(): Promise<{ latestVersion: string | null; releaseUrl: string | null }> {
  const res = await fetch(`https://api.github.com/repos/${SOURCE_REPO}/releases/latest`, {
    headers: { "User-Agent": "Tidetime-Update-Check", Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 404) {
    // No releases published yet.
    return { latestVersion: null, releaseUrl: `https://github.com/${SOURCE_REPO}/releases` };
  }
  if (!res.ok) throw new Error(`GitHub releases returned ${res.status}`);
  const d = (await res.json()) as { tag_name?: string; html_url?: string };
  return {
    latestVersion: d.tag_name ? normalizeVersion(d.tag_name) : null,
    releaseUrl: d.html_url ?? `https://github.com/${SOURCE_REPO}/releases`,
  };
}

export async function isUpdaterAvailable(): Promise<boolean> {
  try {
    const s = await stat(F_HEARTBEAT);
    return Date.now() - s.mtimeMs < HEARTBEAT_MAX_AGE_MS;
  } catch {
    return false;
  }
}

async function readProgress(): Promise<string | null> {
  try {
    const raw = (await readFile(F_STATUS, "utf8")).trim();
    return raw || null;
  } catch {
    return null;
  }
}

/**
 * Current update status. Uses a 30-minute cache so GitHub is queried at most
 * twice an hour. Never throws; a failed check falls back to the last cached
 * result.
 */
export async function getUpdateStatus(force = false): Promise<UpdateStatus> {
  let cache = await readCache();

  const stale =
    !cache ||
    cache.version !== RUNNING_VERSION ||
    Date.now() - new Date(cache.checkedAt).getTime() > CACHE_TTL_MS;

  if (force || stale) {
    try {
      const fresh = await fetchLatestRelease();
      cache = { version: RUNNING_VERSION, ...fresh, checkedAt: new Date().toISOString() };
      await writeCache(cache);
    } catch {
      // Keep whatever we had.
    }
  }

  const latestVersion = cache?.latestVersion ?? null;
  const updateAvailable =
    latestVersion != null && compareVersions(latestVersion, RUNNING_VERSION) > 0;

  const [updaterAvailable, progress] = await Promise.all([isUpdaterAvailable(), readProgress()]);

  return {
    version: RUNNING_VERSION,
    latestVersion,
    updateAvailable,
    checkedAt: cache?.checkedAt ?? null,
    releaseUrl: cache?.releaseUrl ?? null,
    updaterAvailable,
    progress,
  };
}

/**
 * Ask the updater sidecar to pull the new image and restart the stack. Returns
 * { triggered: false } when the sidecar is not running (the caller then shows
 * the manual command).
 */
export async function requestUpdate(): Promise<{ triggered: boolean }> {
  if (!(await isUpdaterAvailable())) return { triggered: false };
  try {
    await writeFile(F_STATUS, "running");
    await writeFile(F_REQUEST, new Date().toISOString());
    return { triggered: true };
  } catch {
    return { triggered: false };
  }
}

/** The manual update command, shown when the updater sidecar is not enabled. */
export const MANUAL_UPDATE_COMMAND =
  "docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d";
