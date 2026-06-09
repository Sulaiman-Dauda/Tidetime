"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { setIntegrationCreds, type IntegrationProvider } from "@/server/integration-credentials";

export type CredentialState = { ok?: boolean; error?: string } | null;

const OAUTH_PROVIDERS: IntegrationProvider[] = [
  "google_calendar",
  "office365_calendar",
  "zoom_video",
  "hubspot",
];

/** Save (or clear) an OAuth provider's client id + secret. Admin only. */
export async function saveOAuthCredsAction(
  provider: IntegrationProvider,
  clientId: string,
  clientSecret: string,
): Promise<CredentialState> {
  await requireAdmin();
  if (!OAUTH_PROVIDERS.includes(provider)) return { error: "Unknown provider" };

  const id = clientId.trim();
  const secret = clientSecret.trim();

  // Both empty → clear (revert to env fallback if any).
  if (!id && !secret) {
    await setIntegrationCreds(provider, null);
    revalidatePath("/dashboard/integrations");
    return { ok: true };
  }
  if (!id || !secret) {
    return { error: "Enter both the Client ID and Client Secret (or clear both)." };
  }
  await setIntegrationCreds(provider, { clientId: id, clientSecret: secret });
  revalidatePath("/dashboard/integrations");
  return { ok: true };
}

/** Save (or clear) the Daily API key, validating it against Daily on save. */
export async function saveDailyCredsAction(
  apiKey: string,
  subdomain: string,
): Promise<CredentialState> {
  await requireAdmin();
  const key = apiKey.trim();
  if (!key) {
    await setIntegrationCreds("daily_video", null);
    revalidatePath("/dashboard/integrations");
    return { ok: true };
  }
  // Live-validate: Daily's /rooms endpoint returns 200 with a valid key.
  try {
    const res = await fetch("https://api.daily.co/v1/rooms?limit=1", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) return { error: "Daily rejected that API key." };
    if (!res.ok) return { error: `Couldn't verify the key (HTTP ${res.status}).` };
  } catch {
    return { error: "Couldn't reach Daily to verify the key. Check your network." };
  }
  await setIntegrationCreds("daily_video", { apiKey: key, subdomain: subdomain.trim() || undefined });
  revalidatePath("/dashboard/integrations");
  return { ok: true };
}
