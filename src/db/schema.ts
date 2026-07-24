import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/*  Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const membershipRole = pgEnum("membership_role", [
  "owner",
  "admin",
  "scheduler",
  "member",
]);
export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "accepted",
  "cancelled",
  "rejected",
]);
export const webhookTrigger = pgEnum("webhook_trigger", [
  "booking_created",
  "booking_rescheduled",
  "booking_cancelled",
  "booking_rejected",
  "booking_requested",
]);

/* -------------------------------------------------------------------------- */
/*  Auth: users, sessions, verification tokens                                */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    /** Stable account handle used in calendar organizer metadata. */
    username: varchar("username", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 128 }),
    /** Job title shown publicly on the booking page (e.g. "Consultant"). */
    position: varchar("position", { length: 128 }),
    /** scrypt hash "salt:hash" */
    passwordHash: text("password_hash").notNull(),
    avatarUrl: text("avatar_url"),
    timeZone: varchar("time_zone", { length: 64 }).notNull().default("UTC"),
    /** 0=Sunday .. 6=Saturday */
    weekStart: integer("week_start").notNull().default(1),
    timeFormat: integer("time_format").notNull().default(12),
    locale: varchar("locale", { length: 16 }).notNull().default("en"),
    /** Instance administrator. */
    isAdmin: boolean("is_admin").notNull().default(false),
    /** TOTP secret (base32) — non-null means two-factor auth is enabled. */
    totpSecret: varchar("totp_secret", { length: 64 }),
    defaultScheduleId: integer("default_schedule_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_idx").on(t.username),
    uniqueIndex("users_email_idx").on(t.email),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** sha-256 of the opaque session token */
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    /** "email_verify" | "password_reset" */
    purpose: varchar("purpose", { length: 32 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* -------------------------------------------------------------------------- */
/*  Teams & memberships                                                       */
/* -------------------------------------------------------------------------- */

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("teams_slug_idx").on(t.slug)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("member"),
    accepted: boolean("accepted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_user_team_idx").on(t.userId, t.teamId)],
);

/* -------------------------------------------------------------------------- */
/*  Availability: schedules + availability blocks                             */
/* -------------------------------------------------------------------------- */

export const schedules = pgTable(
  "schedules",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull().default("Working Hours"),
    timeZone: varchar("time_zone", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("schedules_user_idx").on(t.userId)],
);

/**
 * A weekly recurring block (weekday set) OR a date-specific override (date set).
 * If `date` is set, it overrides the weekly rules for that calendar day.
 * A row with `date` set and null times means the day is fully unavailable.
 */
export const availabilities = pgTable(
  "availabilities",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    /** array of weekday integers 0-6 for recurring rules; empty for date overrides */
    days: integer("days").array().notNull().default([]),
    date: date("date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
  },
  (t) => [index("availabilities_schedule_idx").on(t.scheduleId)],
);

/* -------------------------------------------------------------------------- */
/*  Company services                                                          */
/* -------------------------------------------------------------------------- */

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    description: text("description"),
    /** duration in minutes (default option) */
    length: integer("length").notNull().default(30),
    /** additional offered durations, minutes */
    durations: integer("durations").array().notNull().default([]),
    hidden: boolean("hidden").notNull().default(false),
    /** Newly created and not yet published. */
    draft: boolean("draft").notNull().default(false),
    position: integer("position").notNull().default(0),

    /** locations json: [{type, address?, link?, phone?}] */
    locations: jsonb("locations").$type<EventLocation[]>().notNull().default([]),
    /** booking form questions json */
    bookingFields: jsonb("booking_fields").$type<BookingField[]>().notNull().default([]),

    /** buffers (minutes) */
    beforeEventBuffer: integer("before_event_buffer").notNull().default(0),
    afterEventBuffer: integer("after_event_buffer").notNull().default(0),
    /** minutes of lead time required before a slot can be booked */
    minimumBookingNotice: integer("minimum_booking_notice").notNull().default(120),
    /** granularity of generated slots; null = use length */
    slotInterval: integer("slot_interval"),
    /** attendees that can share one slot (group events); 1 = one-on-one */
    seatsPerSlot: integer("seats_per_slot").notNull().default(1),
    /** cap on accepted bookings per calendar day for this service; null = unlimited */
    maxBookingsPerDay: integer("max_bookings_per_day"),

    requiresConfirmation: boolean("requires_confirmation").notNull().default(false),
    disableGuests: boolean("disable_guests").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("services_team_slug_idx").on(t.teamId, t.slug),
    index("services_team_idx").on(t.teamId),
  ],
);

/** Providers eligible to receive bookings for a company service. */
export const serviceProviders = pgTable(
  "service_providers",
  {
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("service_providers_idx").on(t.serviceId, t.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Bookings & attendees                                                      */
/* -------------------------------------------------------------------------- */

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    uid: varchar("uid", { length: 32 }).notNull(),
    serviceId: integer("service_id").references(() => services.id, { onDelete: "set null" }),
    /** assigned host user */
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),

    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    location: text("location"),
    meetingUrl: text("meeting_url"),

    status: bookingStatus("status").notNull().default("accepted"),
    /** answers to booking fields json */
    responses: jsonb("responses").$type<Record<string, unknown>>().notNull().default({}),

    /** reschedule chain */
    rescheduledFromUid: varchar("rescheduled_from_uid", { length: 32 }),
    cancellationReason: text("cancellation_reason"),

    /** idempotency for double-submit protection */
    idempotencyKey: varchar("idempotency_key", { length: 64 }),

    /**
     * iCalendar SEQUENCE counter. Bumped on every reschedule/cancel so the
     * .ics we email (and the events we write back to external calendars) carry
     * a strictly increasing SEQUENCE — without it Outlook/Apple Calendar ignore
     * update/cancel invites and the attendee's calendar drifts out of sync.
     */
    sequence: integer("sequence").notNull().default(0),


    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("bookings_uid_idx").on(t.uid),
    uniqueIndex("bookings_idempotency_idx").on(t.idempotencyKey),
    index("bookings_user_time_idx").on(t.userId, t.startTime),
    // Booking hot path: daily-cap counts and group-seat checks filter on
    // (serviceId, startTime) inside the booking transaction.
    index("bookings_service_time_idx").on(t.serviceId, t.startTime),
    index("bookings_status_idx").on(t.status),
  ],
);

export const attendees = pgTable(
  "attendees",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    timeZone: varchar("time_zone", { length: 64 }).notNull().default("UTC"),
    phoneNumber: varchar("phone_number", { length: 32 }),
    locale: varchar("locale", { length: 16 }).notNull().default("en"),
    /** true for the primary booker, false for additional guests */
    isPrimary: boolean("is_primary").notNull().default(true),
    /**
     * RSVP round-trip: when an attendee clicks Accept / Decline / Tentative in
     * the calendar invite (or the confirmation email), their reply lands here.
     * "needs_action" until they respond. Mirrors the iCalendar PARTSTAT values.
     */
    rsvpStatus: varchar("rsvp_status", { length: 16 }).notNull().default("needs_action"),
    rsvpRespondedAt: timestamp("rsvp_responded_at", { withTimezone: true }),
  },
  (t) => [index("attendees_booking_idx").on(t.bookingId)],
);

/** Google Calendar event references for sync. */
export const bookingReferences = pgTable(
  "booking_references",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    calendarId: text("calendar_id"),
  },
  (t) => [index("booking_references_booking_idx").on(t.bookingId)],
);

/* -------------------------------------------------------------------------- */
/*  Integrations: credentials, calendars                                      */
/* -------------------------------------------------------------------------- */

export const credentials = pgTable(
  "credentials",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** which calendar the tokens belong to */
    provider: varchar("provider", { length: 16 }).notNull().default("google"),
    /** encrypted JSON token blob */
    key: text("key").notNull(),
    invalid: boolean("invalid").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("credentials_user_idx").on(t.userId, t.provider)],
);

export const selectedCalendars = pgTable(
  "selected_calendars",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
  },
  (t) => [uniqueIndex("selected_calendars_idx").on(t.userId, t.externalId)],
);

/**
 * Read-through cache of Google busy-times for a user, keyed by the
 * window that was fetched. A row "covers" a query when its range is a superset
 * and it hasn't expired — the booking page hammers the same month repeatedly,
 * so this turns N provider round-trips into one cheap Postgres read. Busted
 * whenever we mutate the user's calendar (create/delete event, connect/disconnect).
 */
export const calendarCache = pgTable(
  "calendar_cache",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rangeStart: timestamp("range_start", { withTimezone: true }).notNull(),
    rangeEnd: timestamp("range_end", { withTimezone: true }).notNull(),
    busy: jsonb("busy").$type<{ start: string; end: string }[]>().notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("calendar_cache_user_idx").on(t.userId, t.expiresAt)],
);

export const destinationCalendars = pgTable(
  "destination_calendars",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
  },
  (t) => [uniqueIndex("destination_calendars_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Webhooks                                                                  */
/* -------------------------------------------------------------------------- */

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  subscriberUrl: text("subscriber_url").notNull(),
  triggers: webhookTrigger("triggers").array().notNull().default([]),
  secret: text("secret"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*  Customers (de-duplicated bookers)                                         */
/* -------------------------------------------------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 32 }),
    timeZone: varchar("time_zone", { length: 64 }),
    /** denormalised stats for cheap listing */
    bookingsCount: integer("bookings_count").notNull().default(0),
    lastBookingAt: timestamp("last_booking_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_team_email_idx").on(t.teamId, t.email),
    index("customers_team_idx").on(t.teamId),
  ],
);

/** Global key/value configuration store for instance-wide settings + flags. */
export const appSettings = pgTable("app_settings", {
  name: varchar("name", { length: 128 }).primaryKey(),
  value: jsonb("value"),
});

/**
 * Durable webhook delivery queue with retry + exponential backoff. Each row is
 * one pending/delivered/failed delivery attempt-set for a single subscriber.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    webhookId: integer("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    trigger: webhookTrigger("trigger").notNull(),
    /** full JSON body that was/will be POSTed */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /** "pending" | "success" | "failed" */
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt)],
);

/**
 * Lightweight, append-only activity timeline for a booking. Intentionally not a full audit log —
 * it exists for supportability, not compliance.
 */
export const bookingActivity = pgTable(
  "booking_activity",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    /** created|rescheduled|cancelled|confirmed|rejected|rsvp */
    type: varchar("type", { length: 32 }).notNull(),
    /** who triggered it — attendee name/email, host, or "system" */
    actor: varchar("actor", { length: 255 }),
    message: text("message"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_activity_booking_idx").on(t.bookingId, t.createdAt)],
);

export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  role: membershipRole("role").notNull().default("member"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

/* -------------------------------------------------------------------------- */
/*  Relations                                                                 */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  schedules: many(schedules),
  memberships: many(memberships),
  credentials: many(credentials),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  memberships: many(memberships),
  services: many(services),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  team: one(teams, { fields: [memberships.teamId], references: [teams.id] }),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  user: one(users, { fields: [schedules.userId], references: [users.id] }),
  availabilities: many(availabilities),
}));

export const availabilitiesRelations = relations(availabilities, ({ one }) => ({
  schedule: one(schedules, { fields: [availabilities.scheduleId], references: [schedules.id] }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  team: one(teams, { fields: [services.teamId], references: [teams.id] }),
  providers: many(serviceProviders),
  bookings: many(bookings),
}));

export const serviceProvidersRelations = relations(serviceProviders, ({ one }) => ({
  service: one(services, { fields: [serviceProviders.serviceId], references: [services.id] }),
  user: one(users, { fields: [serviceProviders.userId], references: [users.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  attendees: many(attendees),
  references: many(bookingReferences),
}));

export const attendeesRelations = relations(attendees, ({ one }) => ({
  booking: one(bookings, { fields: [attendees.bookingId], references: [bookings.id] }),
}));

/* -------------------------------------------------------------------------- */
/*  JSON column types                                                         */
/* -------------------------------------------------------------------------- */

export type EventLocation =
  | { type: "in_person"; address: string }
  | { type: "phone"; phone?: string }
  | { type: "attendee_phone" }
  | { type: "link"; link: string }
  | { type: "google_meet" }
  | { type: "jitsi" };

export type BookingFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "checkbox"
  | "select"
  | "date";

export type BookingField = {
  name: string;
  label: string;
  type: BookingFieldType;
  required: boolean;
  /** System fields (name/email) cannot be removed or retyped. */
  system?: boolean;
  /** dropdown choices — required for "select" fields */
  options?: string[];
  /** helper text shown under the input on the public form */
  hint?: string;
};


/* -------------------------------------------------------------------------- */
/*  Inferred types                                                            */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Attendee = typeof attendees.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type Availability = typeof availabilities.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type BookingActivity = typeof bookingActivity.$inferSelect;
export type MembershipRole = (typeof membershipRole.enumValues)[number];
