import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  availabilities,
  memberships,
  schedules,
  serviceProviders,
  services,
  teams,
  users,
  type MembershipRole,
} from "./schema";
import { hashPassword } from "@/lib/crypto";

/**
 * Create (or refresh) two login accounts for manual role testing:
 *   admin@example.com  — instance admin, membership role "admin"
 *   member@example.com — regular provider, membership role "member"
 * Both use the password "password123". Idempotent: safe to re-run.
 */

const TEAM_SLUG = "demo-company";
const SERVICE_SLUG = "intro";

async function ensureUser(opts: {
  email: string;
  username: string;
  name: string;
  isAdmin: boolean;
}): Promise<number> {
  const passwordHash = await hashPassword("password123");
  const [existing] = await db
    .select({ id: users.id, defaultScheduleId: users.defaultScheduleId })
    .from(users)
    .where(eq(users.email, opts.email))
    .limit(1);

  let userId: number;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({ passwordHash, isAdmin: opts.isAdmin, name: opts.name })
      .where(eq(users.id, userId));
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email: opts.email,
        username: opts.username,
        name: opts.name,
        isAdmin: opts.isAdmin,
        passwordHash,
        timeZone: "UTC",
      })
      .returning({ id: users.id });
    userId = created.id;
  }

  // Ensure a full-week schedule so the account can receive bookings.
  const [schedule] = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.userId, userId))
    .limit(1);
  if (!schedule) {
    const [created] = await db
      .insert(schedules)
      .values({ userId, name: "Working Hours", timeZone: "UTC" })
      .returning({ id: schedules.id });
    await db.insert(availabilities).values({
      scheduleId: created.id,
      days: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00:00",
      endTime: "23:59:00",
    });
    await db.update(users).set({ defaultScheduleId: created.id }).where(eq(users.id, userId));
  }

  return userId;
}

async function main() {
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.slug, TEAM_SLUG))
    .limit(1);
  if (!team) throw new Error(`Team "${TEAM_SLUG}" not found — run npm run db:seed first`);

  const accounts: {
    email: string;
    username: string;
    name: string;
    isAdmin: boolean;
    role: MembershipRole;
  }[] = [
    { email: "admin@example.com", username: "admin", name: "Test Admin", isAdmin: true, role: "admin" },
    { email: "scheduler@example.com", username: "scheduler", name: "Test Scheduler", isAdmin: false, role: "scheduler" },
    { email: "member@example.com", username: "member", name: "Test Member", isAdmin: false, role: "member" },
  ];

  for (const acc of accounts) {
    const userId = await ensureUser(acc);
    await db
      .insert(memberships)
      .values({ userId, teamId: team.id, role: acc.role, accepted: true })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.teamId],
        set: { role: acc.role, accepted: true },
      });

    // Give the member an assigned service so the provider views have content.
    if (acc.role === "member") {
      const [svc] = await db
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.teamId, team.id), eq(services.slug, SERVICE_SLUG)))
        .limit(1);
      if (svc) {
        await db
          .insert(serviceProviders)
          .values({ serviceId: svc.id, userId })
          .onConflictDoNothing();
      }
    }

    console.log(`✓ ${acc.email} — role "${acc.role}", isAdmin=${acc.isAdmin}, password "password123"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
