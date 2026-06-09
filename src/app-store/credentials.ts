import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { credentials } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";

/**
 * Generic encrypted per-user credential storage for App Store apps. Reuses the
 * existing `credentials` table (type = app slug, key = encrypted JSON blob) so
 * OAuth apps don't each need bespoke schema.
 */

export interface StoredCredential<T> {
  id: number;
  data: T;
}

export async function saveAppCredential<T>(
  userId: number,
  slug: string,
  data: T,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(credentials)
      .where(and(eq(credentials.userId, userId), eq(credentials.type, slug)));
    await tx
      .insert(credentials)
      .values({ userId, type: slug, key: encrypt(JSON.stringify(data)) });
  });
}

export async function loadAppCredential<T>(
  userId: number,
  slug: string,
): Promise<StoredCredential<T> | null> {
  const [cred] = await db
    .select()
    .from(credentials)
    .where(
      and(
        eq(credentials.userId, userId),
        eq(credentials.type, slug),
        eq(credentials.invalid, false),
      ),
    )
    .limit(1);
  if (!cred) return null;
  try {
    return { id: cred.id, data: JSON.parse(decrypt(cred.key)) as T };
  } catch {
    return null;
  }
}

export async function updateAppCredential<T>(id: number, data: T): Promise<void> {
  await db
    .update(credentials)
    .set({ key: encrypt(JSON.stringify(data)) })
    .where(eq(credentials.id, id));
}

export async function markAppCredentialInvalid(id: number): Promise<void> {
  await db.update(credentials).set({ invalid: true }).where(eq(credentials.id, id));
}

export async function deleteAppCredential(userId: number, slug: string): Promise<void> {
  await db
    .delete(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.type, slug)));
}

export async function hasAppCredential(userId: number, slug: string): Promise<boolean> {
  if (!userId) return false;
  const [cred] = await db
    .select({ id: credentials.id })
    .from(credentials)
    .where(
      and(
        eq(credentials.userId, userId),
        eq(credentials.type, slug),
        eq(credentials.invalid, false),
      ),
    )
    .limit(1);
  return Boolean(cred);
}
