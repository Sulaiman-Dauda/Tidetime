"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, or, and, isNull, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, schedules, availabilities, invites, memberships } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { createSession, destroySession } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/time";
import { requestPasswordReset, resetPassword } from "@/server/password-reset";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { fieldErrorsFromIssues } from "@/lib/schemas";
import { isAdminRole } from "@/lib/rbac";

/** Best-effort client IP for rate-limit keys, from forwarding headers. */
async function clientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

const RESERVED = new Set([
  "api", "app", "dashboard", "login", "signup", "settings", "admin", "auth", "setup",
  "booking", "bookings", "availability", "services", "teams", "_next", "favicon.ico",
  "forgot-password", "reset-password",
]);
const INVITE_ACCEPT_LOCK_NS = 8176;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(128),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(48)
    .regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, - and _ only"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  timeZone: z.string().nullish(),
  inviteToken: z.string(),
});

export type ActionResult = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

export async function signupAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
    timeZone: formData.get("timeZone"),
    inviteToken: formData.get("inviteToken"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };

  // Throttle signups per source IP to curb automated account creation.
  const signupLimit = checkRateLimit(`signup:${await clientIp()}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!signupLimit.ok) return { error: "Too many attempts. Please try again later." };

  const { name, email, username, password, inviteToken } = parsed.data;
  const timeZone = parsed.data.timeZone && isValidTimeZone(parsed.data.timeZone)
    ? parsed.data.timeZone
    : "UTC";

  // Validate invite token
  const [invite] = await db
    .select({ id: invites.id, email: invites.email, teamId: invites.teamId, role: invites.role })
    .from(invites)
    .where(and(eq(invites.token, inviteToken), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
    .limit(1);
  if (!invite) return { error: "This invitation is invalid or has expired." };
  if (invite.email.toLowerCase() !== email) return { error: "The email doesn't match the invitation." };

  if (RESERVED.has(username)) return { fieldErrors: { username: "That username is reserved" } };

  const existing = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .limit(1);
  if (existing.length > 0) {
    return existing[0].email === email
      ? { fieldErrors: { email: "An account with this email already exists" } }
      : { fieldErrors: { username: "That username is taken" } };
  }

  const passwordHash = await hashPassword(password);
  const created = await db.transaction(async (tx): Promise<
    { userId: number } | { error: "invite" | "email" | "username" }
  > => {
    // Serialize acceptance of one invite. Re-check all mutable preconditions
    // inside the transaction so a double-submit cannot create a partial user,
    // membership, or schedule.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${INVITE_ACCEPT_LOCK_NS}, hashtext(${inviteToken}))`,
    );
    const [lockedInvite] = await tx
      .select({ id: invites.id, email: invites.email, teamId: invites.teamId, role: invites.role })
      .from(invites)
      .where(and(
        eq(invites.id, invite.id),
        isNull(invites.acceptedAt),
        gt(invites.expiresAt, new Date()),
      ))
      .limit(1);
    if (!lockedInvite || lockedInvite.email.toLowerCase() !== email) {
      return { error: "invite" };
    }

    const [conflict] = await tx
      .select({ email: users.email, username: users.username })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);
    if (conflict) {
      return { error: conflict.email === email ? "email" : "username" };
    }

    const [user] = await tx
      .insert(users)
      // owner/admin roles are instance administrators — keep the isAdmin flag
      // (which gates company settings, SMTP/M365, domain and webhooks) in sync.
      .values({ name, email, username, passwordHash, timeZone, isAdmin: isAdminRole(lockedInvite.role) })
      .returning({ id: users.id });
    await tx.insert(memberships).values({
      userId: user.id,
      teamId: lockedInvite.teamId,
      role: lockedInvite.role,
      accepted: true,
    });
    await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, lockedInvite.id));

    const [schedule] = await tx
      .insert(schedules)
      .values({ userId: user.id, name: "Working Hours", timeZone })
      .returning({ id: schedules.id });
    await tx.insert(availabilities).values({
      scheduleId: schedule.id,
      days: [1, 2, 3, 4, 5],
      startTime: "09:00:00",
      endTime: "17:00:00",
    });
    await tx.update(users).set({ defaultScheduleId: schedule.id }).where(eq(users.id, user.id));
    return { userId: user.id };
  });

  if ("error" in created) {
    if (created.error === "email") {
      return { fieldErrors: { email: "An account with this email already exists" } };
    }
    if (created.error === "username") {
      return { fieldErrors: { username: "That username is taken" } };
    }
    return { error: "This invitation is invalid or has expired." };
  }

  await createSession(created.userId);
  redirect("/dashboard");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(200),
});

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };

  // Throttle credential attempts per IP and per targeted email to curb brute
  // force and credential stuffing without leaking whether an account exists.
  const ip = await clientIp();
  const ipLimit = checkRateLimit(`login-ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  const emailLimit = checkRateLimit(`login-email:${parsed.data.email}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipLimit.ok || !emailLimit.ok) {
    return { error: "Too many login attempts. Please try again later." };
  }

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  // Constant-ish response regardless of whether the email exists.
  if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);
  // Return success (instead of a server redirect) so the client can play the
  // brief sign-in animation before navigating to the dashboard. The session
  // cookie is already set, so the subsequent client navigation is authenticated.
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/* ---- Password reset --------------------------------------------------- */

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export type ResetActionResult = { error?: string; sent?: boolean; done?: boolean };

export async function requestPasswordResetAction(
  _prev: ResetActionResult,
  formData: FormData,
): Promise<ResetActionResult> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email" };

  // Throttle by email and by source IP to curb abuse / enumeration probing.
  const limited = checkRateLimit(`pwreset:${parsed.data.email}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  const ipLimited = checkRateLimit(`pwreset-ip:${await clientIp()}`, { limit: 15, windowMs: 60 * 60 * 1000 });
  if (!limited.ok || !ipLimited.ok) return { error: "Too many requests. Please try again later." };

  await requestPasswordReset(parsed.data.email);
  // Always report success — never reveal whether the email exists.
  return { sent: true };
}

const resetSchema = z.object({
  token: z.string().min(1, "Invalid reset link"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function resetPasswordAction(
  _prev: ResetActionResult,
  formData: FormData,
): Promise<ResetActionResult> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

  const res = await resetPassword(parsed.data.token, parsed.data.password);
  if (!res.ok) return { error: res.error };
  return { done: true };
}
