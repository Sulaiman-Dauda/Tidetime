import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  availabilities,
  serviceProviders,
  services,
  memberships,
  schedules,
  teams,
  users,
  type BookingField,
} from "./schema";
import { hashPassword } from "@/lib/crypto";

const fields: BookingField[] = [
  { name: "name", label: "Your name", type: "text", required: true, system: true },
  { name: "email", label: "Email", type: "email", required: true, system: true },
  // Seeded so the e2e suite exercises the country picker and E.164 storage.
  { name: "phone", label: "Phone Number", type: "phone", required: true },
  { name: "notes", label: "Notes", type: "textarea", required: false },
];

async function createProvider(email: string, username: string, name: string, isAdmin = false) {
  const [user] = await db.insert(users).values({
    email,
    username,
    name,
    isAdmin,
    passwordHash: await hashPassword("password123"),
    timeZone: "UTC",
  }).returning({ id: users.id });
  const [schedule] = await db.insert(schedules).values({
    userId: user.id,
    name: "Working Hours",
    timeZone: "UTC",
  }).returning({ id: schedules.id });
  await db.insert(availabilities).values({
    scheduleId: schedule.id,
    days: [0, 1, 2, 3, 4, 5, 6],
    startTime: "00:00:00",
    endTime: "23:59:00",
  });
  await db.update(users).set({ defaultScheduleId: schedule.id }).where(eq(users.id, user.id));
  return { ...user, scheduleId: schedule.id };
}

async function seed() {
  const [existing] = await db.select({ id: teams.id }).from(teams).where(eq(teams.slug, "demo-company")).limit(1);
  if (existing) return;

  const owner = await createProvider("owner@example.com", "owner", "Demo Owner", true);
  const provider = await createProvider("provider@example.com", "provider", "Demo Provider");
  const [team] = await db.insert(teams).values({ name: "Demo Company", slug: "demo-company" }).returning({ id: teams.id });
  await db.insert(memberships).values([
    { userId: owner.id, teamId: team.id, role: "owner", accepted: true },
    { userId: provider.id, teamId: team.id, role: "member", accepted: true },
  ]);
  const [service] = await db.insert(services).values({
    teamId: team.id,
    title: "Intro Call",
    slug: "intro",
    description: "A lightweight booking-flow test service.",
    length: 15,
    locations: [{ type: "jitsi" }],
    bookingFields: fields,
    minimumBookingNotice: 0,
  }).returning({ id: services.id });
  await db.insert(serviceProviders).values([
    { serviceId: service.id, userId: owner.id },
    { serviceId: service.id, userId: provider.id },
  ]);
  console.info("Seeded /book/demo-company/intro (owner@example.com / password123)");
}

seed().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
