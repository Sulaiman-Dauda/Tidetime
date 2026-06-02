import { db } from "./index";
import { users, schedules, availabilities, eventTypes } from "./schema";
import { hashPassword } from "@/lib/crypto";
import { eq } from "drizzle-orm";
import type { BookingField, EventLocation } from "./schema";

const DEFAULT_FIELDS: BookingField[] = [
  { name: "name", label: "Your name", type: "text", required: true, system: true },
  { name: "email", label: "Email", type: "email", required: true, system: true },
  { name: "notes", label: "Additional notes", type: "textarea", required: false, placeholder: "Share anything that will help prepare for the meeting." },
];

async function seed() {
  const email = "demo@tidetime.app";
  const username = "demo";

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`Seed user already exists (id=${existing.id}). Skipping.`);
    return;
  }

  const passwordHash = await hashPassword("password123");
  const [user] = await db
    .insert(users)
    .values({
      name: "Demo User",
      email,
      username,
      passwordHash,
      timeZone: "America/New_York",
      bio: "This is a demo account for exploring Tidetime.",
    })
    .returning({ id: users.id });

  const [schedule] = await db
    .insert(schedules)
    .values({ userId: user.id, name: "Working Hours", timeZone: "America/New_York" })
    .returning({ id: schedules.id });

  await db.insert(availabilities).values({
    scheduleId: schedule.id,
    days: [1, 2, 3, 4, 5],
    startTime: "09:00:00",
    endTime: "17:00:00",
  });

  await db.update(users).set({ defaultScheduleId: schedule.id }).where(eq(users.id, user.id));

  const meet: EventLocation = { type: "google_meet" };
  const phone: EventLocation = { type: "attendee_phone" };

  await db.insert(eventTypes).values([
    {
      userId: user.id,
      scheduleId: schedule.id,
      title: "Intro Call",
      slug: "intro",
      description: "A quick 15-minute introduction.",
      length: 15,
      locations: [meet],
      bookingFields: DEFAULT_FIELDS,
      position: 0,
    },
    {
      userId: user.id,
      scheduleId: schedule.id,
      title: "Product Demo",
      slug: "demo",
      description: "A 30-minute walkthrough of the product.",
      length: 30,
      durations: [30, 45],
      locations: [meet],
      bookingFields: DEFAULT_FIELDS,
      position: 1,
    },
    {
      userId: user.id,
      scheduleId: schedule.id,
      title: "Consultation",
      slug: "consult",
      description: "A 60-minute deep-dive consultation.",
      length: 60,
      locations: [phone],
      bookingFields: DEFAULT_FIELDS,
      requiresConfirmation: true,
      position: 2,
    },
  ]);

  console.log("✓ Seeded demo account:");
  console.log("  email:    demo@tidetime.app");
  console.log("  password: password123");
  console.log("  booking:  /demo");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
