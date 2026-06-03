"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/crypto";

export type ApiKeyState = { ok?: boolean; error?: string; plaintext?: string } | null;

/** Create a new API key. The plaintext is returned ONCE and never stored. */
export async function createApiKeyAction(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const user = await requireAdmin();
  const note = formData.get("note");
  const raw = `tt_${randomToken(24)}`;

  await db.insert(apiKeys).values({
    userId: user.id,
    hashedKey: sha256(raw),
    note: typeof note === "string" && note.trim() ? note.trim().slice(0, 128) : null,
  });

  revalidatePath("/dashboard/settings");
  return { ok: true, plaintext: raw };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)));
  revalidatePath("/dashboard/settings");
}
