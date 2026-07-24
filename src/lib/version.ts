/**
 * The git commit this build was produced from. Baked into the production image
 * at build time (Dockerfile ARG TIDETIME_COMMIT, set by CI to the pushed SHA).
 * Empty in local development and in images built before this was added.
 */
export const RUNNING_COMMIT: string | null =
  (process.env.TIDETIME_COMMIT ?? "").trim() || null;

/** GitHub repository the update check compares against. */
export const SOURCE_REPO = "Sulaiman-Dauda/Tidetime";

export function shortCommit(sha: string | null | undefined): string | null {
  return sha ? sha.slice(0, 7) : null;
}
