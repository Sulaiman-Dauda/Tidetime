import "server-only";
import { readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { RUNNING_COMMIT, SOURCE_REPO, shortCommit } from "@/lib/version";

/**
 * Self-update support for Docker deployments.
 *
 * The running image carries the commit it was built from (RUNNING_COMMIT). We
 * compare it against the tip of `main` on GitHub and surface an admin banner
 * when the instance is behind. Performing the update needs Docker access, which
 * the app deliberately does not have, so it hands off to an optional `updater`
 * sidecar (docker-compose.updater.yml) through a shared volume. When that
 * sidecar is not running, the dashboard shows the manual command instead.
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
  /** Commit the running image was built from, or null if unknown (dev/old image). */
  current: string | null;
  currentShort: string | null;
  /** Latest commit on the source repo's main branch. */
  latest: string | null;
  latestShort: string | null;
  /** How many commits behind main, or null when it cannot be determined. */
  behind: number | null;
  updateAvailable: boolean;
  checkedAt: string | null;
  compareUrl: string | null;
  /** Whether the optional updater sidecar is running (one-click possible). */
  updaterAvailable: boolean;
  /** "running" | "done" | "failed" while/after an update, else null. */
  progress: string | null;
}

interface CacheValue {
  current: string | null;
  latest: string | null;
  behind: number | null;
  compareUrl: string | null;
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
    .onConflictDoUpdate({ target: appSettings.name, set: { value: value as unknown as Record<string, unknown> } });
}

async function fetchFromGitHub(current: string | null): Promise<Omit<CacheValue, "checkedAt">> {
  const headers = {
    "User-Agent": "Tidetime-Update-Check",
    Accept: "application/vnd.github+json",
  };
  const signal = AbortSignal.timeout(GITHUB_TIMEOUT_MS);

  if (current) {
    const res = await fetch(
      `https://api.github.com/repos/${SOURCE_REPO}/compare/${current}...main`,
      { headers, signal, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`GitHub compare returned ${res.status}`);
    const d = (await res.json()) as {
      status?: string;
      ahead_by?: number;
      html_url?: string;
      commits?: { sha: string }[];
    };
    const behind = d.status === "identical" ? 0 : d.ahead_by ?? 0;
    const latest = behind > 0 ? d.commits?.[d.commits.length - 1]?.sha ?? null : current;
    return {
      current,
      latest,
      behind,
      compareUrl: d.html_url ?? `https://github.com/${SOURCE_REPO}/compare/${current}...main`,
    };
  }

  const res = await fetch(`https://api.github.com/repos/${SOURCE_REPO}/commits/main`, {
    headers,
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub commits returned ${res.status}`);
  const d = (await res.json()) as { sha?: string };
  return {
    current: null,
    latest: d.sha ?? null,
    behind: null,
    compareUrl: `https://github.com/${SOURCE_REPO}/commits/main`,
  };
}

/** Whether the updater sidecar is alive (fresh heartbeat on the shared volume). */
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
 * twice an hour (well under the unauthenticated rate limit). Never throws; a
 * failed check falls back to the last cached result.
 */
export async function getUpdateStatus(force = false): Promise<UpdateStatus> {
  const current = RUNNING_COMMIT;
  let cache = await readCache();

  const stale =
    !cache ||
    cache.current !== current ||
    Date.now() - new Date(cache.checkedAt).getTime() > CACHE_TTL_MS;

  if (force || stale) {
    try {
      const fresh = await fetchFromGitHub(current);
      cache = { ...fresh, checkedAt: new Date().toISOString() };
      await writeCache(cache);
    } catch {
      // Keep whatever we had; if we had nothing, report unknown.
    }
  }

  const [updaterAvailable, progress] = await Promise.all([isUpdaterAvailable(), readProgress()]);

  return {
    current,
    currentShort: shortCommit(current),
    latest: cache?.latest ?? null,
    latestShort: shortCommit(cache?.latest ?? null),
    behind: cache?.behind ?? null,
    updateAvailable: (cache?.behind ?? 0) > 0,
    checkedAt: cache?.checkedAt ?? null,
    compareUrl: cache?.compareUrl ?? null,
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
    // The shared volume is not writable — fall back to the manual command.
    return { triggered: false };
  }
}

/** The manual update command, shown when the updater sidecar is not enabled. */
export const MANUAL_UPDATE_COMMAND =
  "docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d";
