import pkg from "../../package.json";

/**
 * The running app version, from package.json, baked into the build. Compared
 * against the latest published GitHub release to offer updates.
 */
export const RUNNING_VERSION: string = pkg.version;

/** GitHub repository the update check compares against. */
export const SOURCE_REPO = "Sulaiman-Dauda/Tidetime";

/** Strip a leading "v" from a tag/version string. */
export function normalizeVersion(v: string): string {
  return v.replace(/^v/i, "").trim();
}

/**
 * Compare two semantic versions. Returns a positive number when a > b, a
 * negative number when a < b, and 0 when equal. Non-numeric or missing parts
 * are treated as 0.
 */
export function compareVersions(a: string, b: string): number {
  const pa = normalizeVersion(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = normalizeVersion(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
