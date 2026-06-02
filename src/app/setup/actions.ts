"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, schedules, availabilities, appSettings } from "@/db/schema";
import { hashPassword } from "@/lib/crypto";
import { createSession, hasAnyUser } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/time";

const RESERVED = new Set([
  "api", "app", "dashboard", "login", "signup", "settings", "admin", "auth", "setup",
  "booking", "bookings", "availability", "event-types", "teams", "_next", "favicon.ico",
]);

const setupSchema = z.object({
  instanceName: z.string().trim().max(128).optional(),
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
});

export type SetupResult = { error?: string; fieldErrors?: Record<string, string> };

export async function setupAction(_prev: SetupResult, formData: FormData): Promise<SetupResult> {
  // Onboarding is only available while the instance has no users.
  if (await hasAnyUser()) redirect("/login");

  const parsed = setupSchema.safeParse({
    instanceName: formData.get("instanceName") || undefined,
    name: formData.get("name"),
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
    timeZone: formData.get("timeZone"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
    return { fieldErrors };
  }

  const { name, email, username, password, instanceName } = parsed.data;
  if (RESERVED.has(username)) return { fieldErrors: { username: "That username is reserved" } };

  const timeZone =
    parsed.data.timeZone && isValidTimeZone(parsed.data.timeZone) ? parsed.data.timeZone : "UTC";

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ name, email, username, passwordHash, timeZone, isAdmin: true })
    .returning({ id: users.id });

  // Seed a default Mon–Fri 9–5 working-hours schedule for the owner.
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

  // Persist basic instance configuration.
  await db
    .insert(appSettings)
    .values([
      { name: "instance_name", value: instanceName || "Tidetime" },
      { name: "setup_completed_at", value: new Date().toISOString() },
    ])
    .onConflictDoNothing();

  await createSession(user.id);
  redirect("/dashboard");
}
