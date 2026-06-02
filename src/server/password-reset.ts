import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationTokens, sessions } from "@/db/schema";
import { randomToken, sha256, hashPassword } from "@/lib/crypto";
import { sendMail } from "./mailer";
import { passwordResetEmail } from "./emails";
import { env } from "@/lib/env";

const PURPOSE = "password_reset";
const TTL_MS = 1000 * 60 * 30; // 30 minutes
export const RESET_TTL_MINUTES = 30;

/**
 * Begin a password reset. Always resolves successfully regardless of whether the
 * email exists, to avoid account enumeration. Sends a one-time link when it does.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (!user) return; // silent — no enumeration

  // Invalidate any outstanding reset tokens for this address.
  await db
    .delete(verificationTokens)
    .where(and(eq(verificationTokens.identifier, normalized), eq(verificationTokens.purpose, PURPOSE)));

  const token = randomToken(32);
  const id = sha256(token);
  await db.insert(verificationTokens).values({
    id,
    identifier: normalized,
    purpose: PURPOSE,
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  const resetUrl = `${env.appUrl}/reset-password?token=${token}`;
  const mail = passwordResetEmail(resetUrl, RESET_TTL_MINUTES);
  await sendMail({ to: user.email, subject: mail.subject, html: mail.html });
}

export type ResetResult = { ok: true } | { ok: false; error: string };

/**
 * Complete a password reset using a one-time token. On success the password is
 * updated, the token is consumed, and all existing sessions are revoked.
 */
export async function resetPassword(token: string, newPassword: string): Promise<ResetResult> {
  if (!token) return { ok: false, error: "Invalid or expired link" };
  const id = sha256(token);

  // Opportunistically purge expired tokens.
  await db.delete(verificationTokens).where(lt(verificationTokens.expiresAt, new Date()));

  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(and(eq(verificationTokens.id, id), eq(verificationTokens.purpose, PURPOSE)))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This reset link is invalid or has expired" };
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, row.identifier))
    .limit(1);
  if (!user) return { ok: false, error: "This reset link is invalid or has expired" };

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

  // Consume the token and revoke every active session for safety.
  await db.delete(verificationTokens).where(eq(verificationTokens.id, id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));

  return { ok: true };
}
