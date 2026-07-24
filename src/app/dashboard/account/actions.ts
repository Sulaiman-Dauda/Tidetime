"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { requireUser, revokeOtherSessions } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword, encrypt, decrypt } from "@/lib/crypto";
import { isValidTimeZone } from "@/lib/time";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { env } from "@/lib/env";
import { requestEmailChange } from "@/server/email-change";
import { resolveLocale } from "@/lib/format";

export type SettingsState = { ok?: boolean; error?: string } | null;

/**
 * Re-authenticate a sensitive change with the account password so a hijacked
 * session alone can't take over the account (change email, enroll 2FA).
 * Accounts without a password (none to verify) pass through.
 */
async function verifyCurrentPassword(userId: number, password: unknown): Promise<string | null> {
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row?.passwordHash) return null;
  if (typeof password !== "string" || !password || !(await verifyPassword(password, row.passwordHash))) {
    return "Current password is incorrect";
  }
  return null;
}

const profileSchema = z.object({
  name: z.string().max(128).optional(),
  position: z.string().trim().max(128).optional(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(64)
    .regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, - and _ only"),
  timeZone: z.string().min(1),
  timeFormat: z.coerce.number().int().refine((v) => v === 12 || v === 24),
  weekStart: z.coerce.number().int().min(0).max(6),
  locale: z.string().min(2).max(16).regex(/^[a-zA-Z-]+$/),
});

export async function updateProfileAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name") || undefined,
    position: formData.get("position") ?? undefined,
    username: formData.get("username"),
    timeZone: formData.get("timeZone"),
    timeFormat: formData.get("timeFormat"),
    weekStart: formData.get("weekStart"),
    locale: formData.get("locale") || "en-US",
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
      position: parsed.data.position || null,
      username: parsed.data.username,
      timeZone: parsed.data.timeZone,
      timeFormat: parsed.data.timeFormat,
      weekStart: parsed.data.weekStart,
      locale: resolveLocale(parsed.data.locale),
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

/* ---- Email change ------------------------------------------------------ */

const emailChangeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export async function requestEmailChangeAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = emailChangeSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email" };
  if (parsed.data.email === user.email.toLowerCase()) {
    return { error: "That's already your email address" };
  }
  const passwordError = await verifyCurrentPassword(user.id, formData.get("password"));
  if (passwordError) return { error: passwordError };
  const result = await requestEmailChange(user.id, parsed.data.email);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}

/* ---- Two-factor authentication ---------------------------------------- */

export type TotpSetup = { secret: string; uri: string };

/** Start 2FA enrollment: a fresh secret the user adds to their authenticator.
 *  Nothing is persisted until they prove possession via enableTotpAction. */
export async function beginTotpSetupAction(): Promise<TotpSetup> {
  const user = await requireUser();
  const secret = generateTotpSecret();
  return { secret, uri: totpUri(secret, user.email, env.appName) };
}

const enableTotpSchema = z.object({
  secret: z.string().min(16).max(64).regex(/^[A-Z2-7]+$/),
  code: z.string().min(6).max(8),
});

export async function enableTotpAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = enableTotpSchema.safeParse({
    secret: formData.get("secret"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: "Invalid code" };
  const passwordError = await verifyCurrentPassword(user.id, formData.get("password"));
  if (passwordError) return { error: passwordError };
  if (!verifyTotp(parsed.data.secret, parsed.data.code)) {
    return { error: "That code didn't match. Check your authenticator app and try again." };
  }
  // Encrypted at rest, like every other credential this app stores.
  await db
    .update(users)
    .set({ totpSecret: encrypt(parsed.data.secret), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  revalidatePath("/dashboard/account");
  return { ok: true };
}

export async function disableTotpAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const code = formData.get("code");
  const [row] = await db.select({ totpSecret: users.totpSecret }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row?.totpSecret) return { ok: true };
  if (typeof code !== "string" || !verifyTotp(decrypt(row.totpSecret), code)) {
    return { error: "Enter the current code from your authenticator app to turn 2FA off." };
  }
  await db.update(users).set({ totpSecret: null, updatedAt: new Date() }).where(eq(users.id, user.id));
  revalidatePath("/dashboard/account");
  return { ok: true };
}

/** "Sign out other devices" — revokes every session except the current one. */
export async function signOutOtherSessionsAction(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  await revokeOtherSessions(user.id);
  return { ok: true };
}
