"use server";

import { redirect } from "next/navigation";
import { eq, or, and, isNull, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, schedules, availabilities, invites, memberships } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/time";
import { requestPasswordReset, resetPassword } from "@/server/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";

const RESERVED = new Set([
  "api", "app", "dashboard", "login", "signup", "settings", "admin", "auth", "setup",
  "booking", "bookings", "availability", "event-types", "teams", "_next", "favicon.ico",
  "forgot-password", "reset-password",
]);

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
  timeZone: z.string().optional(),
  inviteToken: z.string(),
  teamId: z.coerce.number().int(),
  role: z.string(),
});

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

export async function signupAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
    timeZone: formData.get("timeZone"),
    inviteToken: formData.get("inviteToken"),
    teamId: formData.get("teamId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
    return { fieldErrors };
  }
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
  if (invite.email !== email) return { error: "The email doesn't match the invitation." };

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
  const [user] = await db
    .insert(users)
    .values({ name, email, username, passwordHash, timeZone })
    .returning({ id: users.id });

  // Auto-join the team
  await db.insert(memberships).values({ userId: user.id, teamId: invite.teamId, role: invite.role, accepted: true });

  // Mark invite as accepted
  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));

  // Seed default schedule
  const [schedule] = await db
    .insert(schedules)
    .values({ userId: user.id, name: "Working Hours", timeZone })
    .returning({ id: schedules.id });
  await db.insert(availabilities).values({
    scheduleId: schedule.id,
    days: [1, 2, 3, 4, 5],
    startTime: "09:00:00",
    endTime: "17:00:00",
  });
  await db.update(users).set({ defaultScheduleId: schedule.id }).where(eq(users.id, user.id));

  await createSession(user.id);
  redirect("/dashboard");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
    return { fieldErrors };
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
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function getSessionUser() {
  return getCurrentUser();
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

  // Throttle by email to curb abuse / enumeration probing.
  const limited = checkRateLimit(`pwreset:${parsed.data.email}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limited.ok) return { error: "Too many requests. Please try again later." };

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
