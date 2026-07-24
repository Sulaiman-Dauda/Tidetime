import "server-only";

/**
 * An error whose message is written for the admin configuring an integration
 * and is safe to show in the UI. Anything else that escapes an integration
 * flow (SDK internals, network failures) is replaced with a generic fallback
 * so raw provider errors never reach the client.
 */
export class IntegrationError extends Error {}

export function integrationErrorMessage(err: unknown, fallback: string): string {
  return err instanceof IntegrationError ? err.message : fallback;
}
