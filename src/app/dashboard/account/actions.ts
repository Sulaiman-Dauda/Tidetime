"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { requireUser, revokeOtherSessions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { isValidTimeZone } from "@/lib/time";

export type SettingsState = { ok?: boolean; error?: string } | null;

const profileSchema = z.object({
  name: z.string().max(128).optional(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(64)
    .regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, - and _ only"),
  timeZone: z.string().min(1),
  timeFormat: z.coerce.number().int().refine((v) => v === 12 || v === 24),
  weekStart: z.coerce.number().int().min(0).max(6),
});

export async function updateProfileAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name") || undefined,
    username: formData.get("username"),
    timeZone: formData.get("timeZone"),
    timeFormat: formData.get("timeFormat"),
    weekStart: formData.get("weekStart"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isValidTimeZone(parsed.data.timeZone)) return { error: "Invalid time zone" };

  // Ensure username uniqueness.
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, parsed.data.username), ne(users.id, user.id)))
    .limit(1);
  if (taken) return { error: "That username is taken" };

  await db
    .update(users)
    .set({
      name: parsed.data.name ?? null,
      username: parsed.data.username,
      timeZone: parsed.data.timeZone,
      timeFormat: parsed.data.timeFormat,
      weekStart: parsed.data.weekStart,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/dashboard/account");
  return { ok: true };
}

const passwordSchema = z
  .object({
    current: z.string().max(200).optional(),
    next: z.string().min(8, "Password must be at least 8 characters").max(200),
  });

export async function updatePasswordAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current") || undefined,
    next: formData.get("next"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // If a password is already set, verify the current one.
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (row?.passwordHash) {
    if (!parsed.data.current || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
      return { error: "Current password is incorrect" };
    }
  }

  const hash = await hashPassword(parsed.data.next);
  await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, user.id));
  // Revoke every other session so a stolen session can't outlive a password change.
  await revokeOtherSessions(user.id);
  return { ok: true };
}
