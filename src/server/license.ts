import "server-only";
import { createPublicKey, verify } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

/**
 * Self-host edition / licensing.
 *
 * Tidetime is free and fully functional as the **Community** edition — nothing
 * here gates any feature. A license simply unlocks the optional **Licensed**
 * edition (e.g. to drop "Powered by Tidetime", or for a future supported tier).
 *
 * Licenses are offline-verifiable: the vendor signs a small JSON payload with an
 * Ed25519 private key; the instance verifies it against the public key in
 * LICENSE_PUBLIC_KEY. No phone-home. With no public key configured, every key is
 * treated as unverified and the edition stays Community.
 */

const LICENSE_SETTING_KEY = "license_key";

export type Edition = "community" | "licensed";

export interface LicenseInfo {
  edition: Edition;
  present: boolean;
  valid: boolean;
  plan?: string;
  expiresAt?: string;
  reason?: string;
}

interface LicensePayload {
  plan?: string;
  sub?: string;
  iat?: number;
  exp?: number;
}

async function storedLicenseKey(): Promise<string | null> {
  if (process.env.LICENSE_KEY) return process.env.LICENSE_KEY;
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, LICENSE_SETTING_KEY))
    .limit(1);
  const value = row?.value as { key?: string } | null | undefined;
  return value?.key ?? null;
}

export async function setLicenseKey(key: string | null): Promise<void> {
  if (!key) {
    await db.delete(appSettings).where(eq(appSettings.name, LICENSE_SETTING_KEY));
    return;
  }
  await db
    .insert(appSettings)
    .values({ name: LICENSE_SETTING_KEY, value: { key } })
    .onConflictDoUpdate({ target: appSettings.name, set: { value: { key } } });
}

function publicKeyPem(): string | null {
  const raw = process.env.LICENSE_PUBLIC_KEY;
  if (!raw) return null;
  // Allow the PEM to be provided with literal "\n" escapes (common in env vars).
  return raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : null;
}

/** Verify a license token offline. Format: base64url(payload).base64url(sig). */
export function verifyLicenseKey(key: string): LicenseInfo {
  const present = Boolean(key);
  if (!present) return { edition: "community", present: false, valid: false };

  const pem = publicKeyPem();
  if (!pem) {
    return { edition: "community", present, valid: false, reason: "no_public_key" };
  }

  const [payloadB64, sigB64] = key.trim().split(".");
  if (!payloadB64 || !sigB64) {
    return { edition: "community", present, valid: false, reason: "malformed" };
  }

  try {
    const ok = verify(
      null,
      Buffer.from(payloadB64),
      createPublicKey(pem),
      Buffer.from(sigB64, "base64url"),
    );
    if (!ok) return { edition: "community", present, valid: false, reason: "bad_signature" };

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as LicensePayload;
    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      return { edition: "community", present, valid: false, reason: "expired", plan: payload.plan };
    }
    return {
      edition: "licensed",
      present,
      valid: true,
      plan: payload.plan,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
    };
  } catch {
    return { edition: "community", present, valid: false, reason: "invalid" };
  }
}

export async function getLicenseInfo(): Promise<LicenseInfo> {
  const key = await storedLicenseKey();
  if (!key) return { edition: "community", present: false, valid: false };
  return verifyLicenseKey(key);
}

export async function getEdition(): Promise<Edition> {
  return (await getLicenseInfo()).edition;
}
