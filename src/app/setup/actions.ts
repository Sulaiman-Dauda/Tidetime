"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, schedules, availabilities, appSettings, teams, memberships } from "@/db/schema";
import { hashPassword } from "@/lib/crypto";
import { createSession, hasAnyUser } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/time";
import { fieldErrorsFromIssues } from "@/lib/schemas";
import {
  COMPANY_SETTING_KEYS,
  DEFAULT_COMPANY_PROFILE,
  normalizeBrandColor,
  normalizeCurrency,
} from "@/lib/company-settings";

const RESERVED = new Set([
  "api", "app", "dashboard", "login", "signup", "settings", "admin", "auth", "setup",
  "booking", "bookings", "availability", "event-types", "teams", "_next", "favicon.ico",
]);
const SETUP_LOCK_ID = 20_260_604;

const setupSchema = z
  .object({
    instanceName: z.string().trim().max(128).optional(),
    companyEmail: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
    companyWebsite: z.union([z.string().trim().url("Enter a valid URL"), z.literal("")]).optional(),
    defaultCurrency: z.string().trim().optional(),
    name: z.string().trim().min(1, "Name is required").max(128),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    timeZone: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

/**
 * Derive a valid, non-reserved username from the owner's email local-part so
 * onboarding stays a two-field account step. First-run only, so collisions with
 * other accounts are impossible.
 */
function deriveUsername(email: string): string {
  let base = (email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_-]+/g, "");
  if (base.length < 3) base = `user${base}`;
  base = base.slice(0, 40);
  return RESERVED.has(base) ? `${base}1` : base;
}

export type SetupResult = { error?: string; fieldErrors?: Record<string, string> };

export async function setupAction(_prev: SetupResult, formData: FormData): Promise<SetupResult> {
  // Onboarding is only available while the instance has no users.
  if (await hasAnyUser()) redirect("/login");

  const parsed = setupSchema.safeParse({
    instanceName: formData.get("instanceName") || undefined,
    companyEmail: formData.get("companyEmail") || undefined,
    companyWebsite: formData.get("companyWebsite") || undefined,
    defaultCurrency: formData.get("defaultCurrency") || undefined,
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    timeZone: formData.get("timeZone"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFromIssues(parsed.error.issues) };

  const { name, email, password, instanceName } = parsed.data;
  const username = deriveUsername(email);

  const timeZone =
    parsed.data.timeZone && isValidTimeZone(parsed.data.timeZone) ? parsed.data.timeZone : "UTC";

  const passwordHash = await hashPassword(password);
  const companyProfile = {
    ...DEFAULT_COMPANY_PROFILE,
    name: instanceName || DEFAULT_COMPANY_PROFILE.name,
    email: parsed.data.companyEmail || "",
    websiteUrl: parsed.data.companyWebsite || "",
    brandColor: normalizeBrandColor(DEFAULT_COMPANY_PROFILE.brandColor),
    defaultCurrency: normalizeCurrency(parsed.data.defaultCurrency),
  };

  const setup = await db.transaction(async (tx) => {
    // Serialize first-run setup so only one owner account can ever win.
    await tx.execute(sql`select pg_advisory_xact_lock(${SETUP_LOCK_ID})`);

    const [existingUser] = await tx.select({ id: users.id }).from(users).limit(1);
    if (existingUser) return { alreadySetup: true as const };

    const [user] = await tx
      .insert(users)
      .values({ name, email, username, passwordHash, timeZone, isAdmin: true })
      .returning({ id: users.id });

    // Seed a default Mon–Fri 9–5 working-hours schedule for the owner.
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

    await tx
      .insert(appSettings)
      .values([
        { name: "instance_name", value: instanceName || "Tidetime" },
        { name: "setup_completed_at", value: new Date().toISOString() },
        { name: COMPANY_SETTING_KEYS.profile, value: companyProfile },
      ])
      .onConflictDoNothing();

    const [team] = await tx
      .insert(teams)
      .values({ name: instanceName || "My Organization", slug: "default" })
      .returning({ id: teams.id });

    await tx.insert(memberships).values({ userId: user.id, teamId: team.id, role: "owner", accepted: true });

    return { userId: user.id };
  });

  if ("alreadySetup" in setup) redirect("/login");

  await createSession(setup.userId);
  redirect("/dashboard/event-types?welcome=1");
}
