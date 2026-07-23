import "server-only";
import { and, eq, gt, or } from "drizzle-orm";
import { db } from "@/db";
import { users, verificationTokens } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendMail } from "./mailer";
import { getAppUrl } from "./app-url";
import { env } from "@/lib/env";

const PURPOSE = "email_change";
const TTL_MS = 1000 * 60 * 30; // 30 minutes

export type EmailChangeResult = { ok: true } | { ok: false; error: string };

/**
 * Begin an email change: a one-time link is sent to the NEW address, proving
 * the user controls it before anything is updated.
 */
export async function requestEmailChange(userId: number, newEmail: string): Promise<EmailChangeResult> {
  const normalized = newEmail.trim().toLowerCase();

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (taken) return { ok: false, error: "An account with that email already exists" };

  // One outstanding change request per user.
  await db
    .delete(verificationTokens)
    .where(and(eq(verificationTokens.purpose, PURPOSE), eq(verificationTokens.identifier, `${userId}:${normalized}`)));

  const token = randomToken(32);
  await db.insert(verificationTokens).values({
    id: sha256(token),
    identifier: `${userId}:${normalized}`,
    purpose: PURPOSE,
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  const verifyUrl = `${await getAppUrl()}/api/verify-email?token=${token}`;
  await sendMail({
    to: normalized,
    subject: `Confirm your new ${env.appName} email`,
    html: `<p>Click the link below within 30 minutes to confirm this as your new ${env.appName} sign-in email.</p><p><a href="${verifyUrl}">Confirm email change</a></p><p>If you didn't request this, you can ignore this message.</p>`,
  });
  return { ok: true };
}

/** Complete an email change from the emailed one-time link. */
export async function confirmEmailChange(token: string): Promise<EmailChangeResult> {
  if (!token) return { ok: false, error: "Invalid or expired link" };
  const id = sha256(token);

  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.id, id),
      eq(verificationTokens.purpose, PURPOSE),
      gt(verificationTokens.expiresAt, new Date()),
    ))
    .limit(1);
  if (!row) return { ok: false, error: "This link is invalid or has expired." };

  const separator = row.identifier.indexOf(":");
  const userId = Number(row.identifier.slice(0, separator));
  const newEmail = row.identifier.slice(separator + 1);
  if (!Number.isInteger(userId) || !newEmail) return { ok: false, error: "This link is invalid." };

  // Re-check uniqueness at confirm time.
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, newEmail)))
    .limit(1);
  if (taken && taken.id !== userId) {
    return { ok: false, error: "That email address is no longer available." };
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ email: newEmail, updatedAt: new Date() }).where(eq(users.id, userId));
    await tx
      .delete(verificationTokens)
      .where(or(eq(verificationTokens.id, id), eq(verificationTokens.identifier, row.identifier)));
  });
  return { ok: true };
}
