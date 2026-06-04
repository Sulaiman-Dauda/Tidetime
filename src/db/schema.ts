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
  "manager",
  "provider",
  "receptionist",
  "member",
]);
export const schedulingType = pgEnum("scheduling_type", ["round_robin", "collective", "managed"]);
export const roundRobinMode = pgEnum("round_robin_mode", ["sequential", "least_busy", "random"]);
export const periodType = pgEnum("period_type", ["unlimited", "rolling", "rolling_window", "range"]);
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
  "meeting_started",
  "meeting_ended",
]);
export const workflowTrigger = pgEnum("workflow_trigger", [
  "before_event",
  "after_event",
  "event_created",
  "event_cancelled",
  "event_rescheduled",
]);
export const workflowAction = pgEnum("workflow_action", ["email_attendee", "email_host", "sms_attendee"]);
export const resourceType = pgEnum("resource_type", [
  "room",
  "studio",
  "equipment",
  "vehicle",
  "desk",
  "other",
]);

/* -------------------------------------------------------------------------- */
/*  Auth: users, sessions, verification tokens                                */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    /** public booking handle, e.g. tidetime.app/jane */
    username: varchar("username", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    name: varchar("name", { length: 128 }),
    /** scrypt hash "salt:hash" — null for SSO-only accounts */
    passwordHash: text("password_hash"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    timeZone: varchar("time_zone", { length: 64 }).notNull().default("UTC"),
    /** 0=Sunday .. 6=Saturday */
    weekStart: integer("week_start").notNull().default(1),
    timeFormat: integer("time_format").notNull().default(12),
    locale: varchar("locale", { length: 16 }).notNull().default("en"),
    theme: varchar("theme", { length: 16 }),
    brandColor: varchar("brand_color", { length: 9 }),
    hideBranding: boolean("hide_branding").notNull().default(false),
    /** post-booking reviews: redirect happy customers to this URL */
    googleReviewUrl: text("google_review_url"),
    /** ratings >= this threshold (1-5) are routed to the public review URL */
    reviewThreshold: integer("review_threshold").notNull().default(4),
    /** send a review request after the meeting ends */
    reviewRequestsEnabled: boolean("review_requests_enabled").notNull().default(false),
    /** platform super-admin */
    isAdmin: boolean("is_admin").notNull().default(false),
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
/*  Organizations, teams & memberships                                        */
/* -------------------------------------------------------------------------- */

export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    logoUrl: text("logo_url"),
    brandColor: varchar("brand_color", { length: 9 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("organizations_slug_idx").on(t.slug)],
);

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    logoUrl: text("logo_url"),
    bio: text("bio"),
    hideBranding: boolean("hide_branding").notNull().default(false),
    brandColor: varchar("brand_color", { length: 9 }),
    /** team capacity rules */
    maxBookingsPerDay: integer("max_bookings_per_day"),
    maxConcurrentBookings: integer("max_concurrent_bookings"),
    /** post-booking reviews */
    googleReviewUrl: text("google_review_url"),
    reviewThreshold: integer("review_threshold").notNull().default(4),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("teams_slug_idx").on(t.slug),
    index("teams_org_idx").on(t.organizationId),
  ],
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
/*  Service categories (group event types / services)                          */
/* -------------------------------------------------------------------------- */

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: serial("id").primaryKey(),
    /** null = instance-wide; otherwise scoped to a team */
    teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 9 }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("service_categories_team_idx").on(t.teamId)],
);

/* -------------------------------------------------------------------------- */
/*  Event types                                                               */
/* -------------------------------------------------------------------------- */

export const eventTypes = pgTable(
  "event_types",
  {
    id: serial("id").primaryKey(),
    /** owner — either a personal user OR a team event */
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
    scheduleId: integer("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
    /** optional service category for grouping on the booking page */
    categoryId: integer("category_id").references(() => serviceCategories.id, {
      onDelete: "set null",
    }),

    title: varchar("title", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    description: text("description"),
    /** duration in minutes (default option) */
    length: integer("length").notNull().default(30),
    /** additional offered durations, minutes */
    durations: integer("durations").array().notNull().default([]),
    hidden: boolean("hidden").notNull().default(false),
    position: integer("position").notNull().default(0),
    color: varchar("color", { length: 9 }),

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
    /** minutes to offset slot start times within each working window (e.g. 15 → :15/:45) */
    offsetStart: integer("offset_start").notNull().default(0),

    /** future booking window */
    periodType: periodType("period_type").notNull().default("unlimited"),
    periodDays: integer("period_days"),
    periodStartDate: date("period_start_date"),
    periodEndDate: date("period_end_date"),

    /** frequency caps json: {day?:n, week?:n, month?:n, year?:n} */
    bookingLimits: jsonb("booking_limits").$type<Record<string, number>>(),
    durationLimits: jsonb("duration_limits").$type<Record<string, number>>(),

    /** capacity per slot; null = 1 */
    seatsPerTimeSlot: integer("seats_per_time_slot"),
    seatsShowAttendees: boolean("seats_show_attendees").notNull().default(false),

    requiresConfirmation: boolean("requires_confirmation").notNull().default(false),
    disableGuests: boolean("disable_guests").notNull().default(false),
    /** recurring rule json: {freq, interval, count} */
    recurringEvent: jsonb("recurring_event").$type<RecurringRule | null>(),

    price: integer("price").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),

    successRedirectUrl: text("success_redirect_url"),
    /** team scheduling */
    schedulingType: schedulingType("scheduling_type"),
    /** distribution strategy for round-robin team events */
    roundRobinMode: roundRobinMode("round_robin_mode").notNull().default("sequential"),

    /** deposit charged up-front (in cents); 0 = full price or free */
    depositAmount: integer("deposit_amount").notNull().default(0),
    /** require successful payment before the booking is confirmed */
    requiresPayment: boolean("requires_payment").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("event_types_user_slug_idx").on(t.userId, t.slug),
    index("event_types_team_idx").on(t.teamId),
  ],
);

/** team event hosts (round-robin / collective) */
export const eventTypeHosts = pgTable(
  "event_type_hosts",
  {
    eventTypeId: integer("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isFixed: boolean("is_fixed").notNull().default(false),
    priority: integer("priority").notNull().default(2),
    weight: integer("weight").notNull().default(100),
  },
  (t) => [uniqueIndex("event_type_hosts_idx").on(t.eventTypeId, t.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Bookings & attendees                                                      */
/* -------------------------------------------------------------------------- */

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    uid: varchar("uid", { length: 32 }).notNull(),
    eventTypeId: integer("event_type_id").references(() => eventTypes.id, { onDelete: "set null" }),
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
    cancelledByEmail: varchar("cancelled_by_email", { length: 255 }),
    /** recurring series id */
    recurringEventId: varchar("recurring_event_id", { length: 32 }),

    /** idempotency for double-submit protection */
    idempotencyKey: varchar("idempotency_key", { length: 64 }),
    paid: boolean("paid").notNull().default(false),

    /** set when a post-booking review request email has been sent (dedup) */
    reviewRequestSentAt: timestamp("review_request_sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("bookings_uid_idx").on(t.uid),
    uniqueIndex("bookings_idempotency_idx").on(t.idempotencyKey),
    index("bookings_user_time_idx").on(t.userId, t.startTime),
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
    noShow: boolean("no_show").notNull().default(false),
    /** true for the primary booker, false for additional guests */
    isPrimary: boolean("is_primary").notNull().default(true),
  },
  (t) => [index("attendees_booking_idx").on(t.bookingId)],
);

/** external calendar event references for sync */
export const bookingReferences = pgTable(
  "booking_references",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    uid: text("uid").notNull(),
    meetingUrl: text("meeting_url"),
    externalCalendarId: text("external_calendar_id"),
    credentialId: integer("credential_id"),
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
    /** e.g. "google_calendar", "stripe", "caldav" */
    type: varchar("type", { length: 64 }).notNull(),
    /** encrypted JSON token blob */
    key: text("key").notNull(),
    invalid: boolean("invalid").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credentials_user_idx").on(t.userId)],
);

export const selectedCalendars = pgTable(
  "selected_calendars",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: integer("credential_id").references(() => credentials.id, { onDelete: "cascade" }),
    integration: varchar("integration", { length: 64 }).notNull(),
    externalId: text("external_id").notNull(),
  },
  (t) => [uniqueIndex("selected_calendars_idx").on(t.userId, t.integration, t.externalId)],
);

export const destinationCalendars = pgTable(
  "destination_calendars",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    eventTypeId: integer("event_type_id").references(() => eventTypes.id, { onDelete: "cascade" }),
    credentialId: integer("credential_id").references(() => credentials.id, { onDelete: "cascade" }),
    integration: varchar("integration", { length: 64 }).notNull(),
    externalId: text("external_id").notNull(),
    primaryEmail: varchar("primary_email", { length: 255 }),
  },
  (t) => [
    uniqueIndex("destination_calendars_user_idx").on(t.userId),
    uniqueIndex("destination_calendars_event_idx").on(t.eventTypeId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Webhooks, workflows, payments, api keys, out-of-office, settings          */
/* -------------------------------------------------------------------------- */

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
  eventTypeId: integer("event_type_id").references(() => eventTypes.id, { onDelete: "cascade" }),
  subscriberUrl: text("subscriber_url").notNull(),
  triggers: webhookTrigger("triggers").array().notNull().default([]),
  secret: text("secret"),
  payloadTemplate: text("payload_template"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  trigger: workflowTrigger("trigger").notNull(),
  action: workflowAction("action").notNull(),
  /** minutes offset for before/after triggers */
  offsetMinutes: integer("offset_minutes").notNull().default(0),
  /** null = applies to all of the user's event types */
  eventTypeId: integer("event_type_id").references(() => eventTypes.id, { onDelete: "cascade" }),
  subject: text("subject"),
  body: text("body"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** scheduled reminder jobs derived from workflows */
export const scheduledReminders = pgTable(
  "scheduled_reminders",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    workflowId: integer("workflow_id").references(() => workflows.id, { onDelete: "cascade" }),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    action: workflowAction("action").notNull(),
  },
  (t) => [index("scheduled_reminders_due_idx").on(t.sendAt, t.sentAt)],
);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  uid: varchar("uid", { length: 32 }).notNull(),
  bookingId: integer("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  fee: integer("fee").notNull().default(0),
  success: boolean("success").notNull().default(false),
  refunded: boolean("refunded").notNull().default(false),
  /** "pending" | "paid" | "failed" | "refunded" — explicit lifecycle tracking */
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  /** "stripe" */
  provider: varchar("provider", { length: 32 }).notNull().default("stripe"),
  externalId: text("external_id"),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("payments_uid_idx").on(t.uid),
  index("payments_booking_idx").on(t.bookingId),
]);

/* -------------------------------------------------------------------------- */
/*  Customers (de-duplicated bookers)                                         */
/* -------------------------------------------------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    /** owning user OR team — customers are scoped to a provider/team */
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 32 }),
    timeZone: varchar("time_zone", { length: 64 }),
    notes: text("notes"),
    /** denormalised stats for cheap listing */
    bookingsCount: integer("bookings_count").notNull().default(0),
    noShowCount: integer("no_show_count").notNull().default(0),
    lastBookingAt: timestamp("last_booking_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_user_email_idx").on(t.userId, t.email),
    index("customers_team_idx").on(t.teamId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Temporary / one-time booking links                                        */
/* -------------------------------------------------------------------------- */

export const bookingLinks = pgTable(
  "booking_links",
  {
    id: serial("id").primaryKey(),
    /** random opaque token used in the public URL */
    token: varchar("token", { length: 64 }).notNull(),
    eventTypeId: integer("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "one_time" | "expiring" | "limited" | "invite" */
    kind: varchar("kind", { length: 16 }).notNull().default("one_time"),
    /** max successful bookings before the link is dead; null = unlimited */
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** invite-only: lock the link to a specific email */
    inviteEmail: varchar("invite_email", { length: 255 }),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("booking_links_token_idx").on(t.token)],
);

/* -------------------------------------------------------------------------- */
/*  Resource scheduling (rooms, studios, equipment, vehicles, desks)          */
/* -------------------------------------------------------------------------- */

export const resources = pgTable(
  "resources",
  {
    id: serial("id").primaryKey(),
    /** owned by a user OR a team */
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    type: resourceType("type").notNull().default("room"),
    description: text("description"),
    /** how many concurrent bookings this resource supports; 1 = exclusive */
    capacity: integer("capacity").notNull().default(1),
    color: varchar("color", { length: 9 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resources_user_idx").on(t.userId), index("resources_team_idx").on(t.teamId)],
);

/** event types that require / use a given resource */
export const eventTypeResources = pgTable(
  "event_type_resources",
  {
    eventTypeId: integer("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    resourceId: integer("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    /** when true the slot is unavailable unless the resource is free */
    required: boolean("required").notNull().default(true),
  },
  (t) => [
    uniqueIndex("event_type_resources_idx").on(t.eventTypeId, t.resourceId),
    index("event_type_resources_resource_idx").on(t.resourceId),
  ],
);

/** resources reserved by a specific booking */
export const bookingResources = pgTable(
  "booking_resources",
  {
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    resourceId: integer("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("booking_resources_idx").on(t.bookingId, t.resourceId),
    index("booking_resources_resource_idx").on(t.resourceId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Reviews (post-booking feedback + reputation routing)                      */
/* -------------------------------------------------------------------------- */

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    /** host the review is about */
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    teamId: integer("team_id").references(() => teams.id, { onDelete: "set null" }),
    /** 1-5 stars */
    rating: integer("rating").notNull(),
    feedback: text("feedback"),
    attendeeEmail: varchar("attendee_email", { length: 255 }),
    attendeeName: varchar("attendee_name", { length: 128 }),
    /** true when the rating met the threshold and the customer was sent to the public URL */
    redirectedToPublic: boolean("redirected_to_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_booking_idx").on(t.bookingId),
    index("reviews_user_idx").on(t.userId),
    index("reviews_team_idx").on(t.teamId),
  ],
);

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** sha-256 of the key; never store plaintext */
  hashedKey: varchar("hashed_key", { length: 64 }).notNull(),
  note: varchar("note", { length: 128 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outOfOffice = pgTable("out_of_office", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
  notes: text("notes"),
  /** optionally redirect bookings to another user */
  toUserId: integer("to_user_id").references(() => users.id, { onDelete: "set null" }),
});

/** global key/value configuration (mirrors EasyAppointments settings table) */
export const appSettings = pgTable("app_settings", {
  name: varchar("name", { length: 128 }).primaryKey(),
  value: jsonb("value"),
});

/**
 * Company-wide blocked periods that override every provider's availability
 * (holidays, maintenance windows, etc). A null teamId blocks the whole instance;
 * a teamId scopes the block to that team's members.
 */
export const blockedPeriods = pgTable(
  "blocked_periods",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id").references(() => teams.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 255 }),
    start: timestamp("start", { withTimezone: true }).notNull(),
    end: timestamp("end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blocked_periods_range_idx").on(t.start, t.end)],
);

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
 * Lightweight, append-only activity timeline for a booking (created, rescheduled,
 * cancelled, payment, reminder, review, …). Intentionally not a full audit log —
 * it exists for supportability, not compliance.
 */
export const bookingActivity = pgTable(
  "booking_activity",
  {
    id: serial("id").primaryKey(),
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    /** created|rescheduled|cancelled|confirmed|rejected|payment_succeeded|reminder_sent|review_submitted|no_show */
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
  eventTypes: many(eventTypes),
  memberships: many(memberships),
  credentials: many(credentials),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  memberships: many(memberships),
  eventTypes: many(eventTypes),
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

export const eventTypesRelations = relations(eventTypes, ({ one, many }) => ({
  user: one(users, { fields: [eventTypes.userId], references: [users.id] }),
  team: one(teams, { fields: [eventTypes.teamId], references: [teams.id] }),
  schedule: one(schedules, { fields: [eventTypes.scheduleId], references: [schedules.id] }),
  hosts: many(eventTypeHosts),
  bookings: many(bookings),
}));

export const eventTypeHostsRelations = relations(eventTypeHosts, ({ one }) => ({
  eventType: one(eventTypes, { fields: [eventTypeHosts.eventTypeId], references: [eventTypes.id] }),
  user: one(users, { fields: [eventTypeHosts.userId], references: [users.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  eventType: one(eventTypes, { fields: [bookings.eventTypeId], references: [eventTypes.id] }),
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
  | { type: "zoom" };

export type BookingFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "multiselect";

/** Show this field only when another field has one of these values. */
export interface BookingFieldCondition {
  field: string;
  equals: string[];
}

export type BookingField = {
  name: string;
  label: string;
  type: BookingFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  /** conditional visibility — field is hidden until the condition is met */
  showWhen?: BookingFieldCondition;
  /** system fields (name/email) cannot be removed or retyped, but their
   * label/placeholder/required/hidden can be overridden */
  system?: boolean;
  /** hide an optional field from the booking form without deleting it */
  hidden?: boolean;
};

export type RecurringRule = {
  freq: "weekly" | "monthly";
  interval: number;
  count: number;
};

/* -------------------------------------------------------------------------- */
/*  Inferred types                                                            */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type EventType = typeof eventTypes.$inferSelect;
export type NewEventType = typeof eventTypes.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Attendee = typeof attendees.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type Availability = typeof availabilities.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type BookingLink = typeof bookingLinks.$inferSelect;
export type NewBookingLink = typeof bookingLinks.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type BookingActivity = typeof bookingActivity.$inferSelect;export type ResourceType = (typeof resourceType.enumValues)[number];
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Workflow = typeof workflows.$inferSelect;
export type ScheduledReminder = typeof scheduledReminders.$inferSelect;
export type MembershipRole = (typeof membershipRole.enumValues)[number];
export type SchedulingType = (typeof schedulingType.enumValues)[number];
