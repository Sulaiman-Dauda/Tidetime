CREATE TYPE "public"."booking_status" AS ENUM('pending', 'accepted', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."period_type" AS ENUM('unlimited', 'rolling', 'rolling_window', 'range');--> statement-breakpoint
CREATE TYPE "public"."scheduling_type" AS ENUM('round_robin', 'collective', 'managed');--> statement-breakpoint
CREATE TYPE "public"."webhook_trigger" AS ENUM('booking_created', 'booking_rescheduled', 'booking_cancelled', 'booking_rejected', 'booking_requested', 'meeting_started', 'meeting_ended');--> statement-breakpoint
CREATE TYPE "public"."workflow_action" AS ENUM('email_attendee', 'email_host', 'sms_attendee');--> statement-breakpoint
CREATE TYPE "public"."workflow_trigger" AS ENUM('before_event', 'after_event', 'event_created', 'event_cancelled', 'event_rescheduled');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"hashed_key" varchar(64) NOT NULL,
	"note" varchar(128),
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"name" varchar(128) PRIMARY KEY NOT NULL,
	"value" jsonb
);
--> statement-breakpoint
CREATE TABLE "attendees" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(128) NOT NULL,
	"time_zone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"phone_number" varchar(32),
	"locale" varchar(16) DEFAULT 'en' NOT NULL,
	"no_show" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_id" integer NOT NULL,
	"days" integer[] DEFAULT '{}' NOT NULL,
	"date" date,
	"start_time" time,
	"end_time" time
);
--> statement-breakpoint
CREATE TABLE "booking_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"uid" text NOT NULL,
	"meeting_url" text,
	"external_calendar_id" text,
	"credential_id" integer
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" varchar(32) NOT NULL,
	"event_type_id" integer,
	"user_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"location" text,
	"meeting_url" text,
	"status" "booking_status" DEFAULT 'accepted' NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rescheduled_from_uid" varchar(32),
	"cancellation_reason" text,
	"cancelled_by_email" varchar(255),
	"recurring_event_id" varchar(32),
	"idempotency_key" varchar(64),
	"paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"key" text NOT NULL,
	"invalid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destination_calendars" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"event_type_id" integer,
	"credential_id" integer,
	"integration" varchar(64) NOT NULL,
	"external_id" text NOT NULL,
	"primary_email" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "event_type_hosts" (
	"event_type_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"is_fixed" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"schedule_id" integer,
	"title" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"length" integer DEFAULT 30 NOT NULL,
	"durations" integer[] DEFAULT '{}' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"color" varchar(9),
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"before_event_buffer" integer DEFAULT 0 NOT NULL,
	"after_event_buffer" integer DEFAULT 0 NOT NULL,
	"minimum_booking_notice" integer DEFAULT 120 NOT NULL,
	"slot_interval" integer,
	"period_type" "period_type" DEFAULT 'unlimited' NOT NULL,
	"period_days" integer,
	"period_start_date" date,
	"period_end_date" date,
	"booking_limits" jsonb,
	"duration_limits" jsonb,
	"seats_per_time_slot" integer,
	"seats_show_attendees" boolean DEFAULT false NOT NULL,
	"requires_confirmation" boolean DEFAULT false NOT NULL,
	"disable_guests" boolean DEFAULT false NOT NULL,
	"recurring_event" jsonb,
	"price" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"success_redirect_url" text,
	"scheduling_type" "scheduling_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "out_of_office" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone NOT NULL,
	"notes" text,
	"to_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" varchar(32) NOT NULL,
	"booking_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"fee" integer DEFAULT 0 NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"refunded" boolean DEFAULT false NOT NULL,
	"external_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"workflow_id" integer,
	"send_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"action" "workflow_action" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(128) DEFAULT 'Working Hours' NOT NULL,
	"time_zone" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "selected_calendars" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"credential_id" integer,
	"integration" varchar(64) NOT NULL,
	"external_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"logo_url" text,
	"bio" text,
	"hide_branding" boolean DEFAULT false NOT NULL,
	"brand_color" varchar(9),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"name" varchar(128),
	"password_hash" text,
	"avatar_url" text,
	"bio" text,
	"time_zone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"week_start" integer DEFAULT 1 NOT NULL,
	"time_format" integer DEFAULT 12 NOT NULL,
	"locale" varchar(16) DEFAULT 'en' NOT NULL,
	"theme" varchar(16),
	"brand_color" varchar(9),
	"hide_branding" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"default_schedule_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"purpose" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"event_type_id" integer,
	"subscriber_url" text NOT NULL,
	"triggers" "webhook_trigger"[] DEFAULT '{}' NOT NULL,
	"secret" text,
	"payload_template" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"trigger" "workflow_trigger" NOT NULL,
	"action" "workflow_action" NOT NULL,
	"offset_minutes" integer DEFAULT 0 NOT NULL,
	"event_type_id" integer,
	"subject" text,
	"body" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_references" ADD CONSTRAINT "booking_references_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_calendars" ADD CONSTRAINT "destination_calendars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_calendars" ADD CONSTRAINT "destination_calendars_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_calendars" ADD CONSTRAINT "destination_calendars_credential_id_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_type_hosts" ADD CONSTRAINT "event_type_hosts_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_type_hosts" ADD CONSTRAINT "event_type_hosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "out_of_office" ADD CONSTRAINT "out_of_office_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "out_of_office" ADD CONSTRAINT "out_of_office_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reminders" ADD CONSTRAINT "scheduled_reminders_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reminders" ADD CONSTRAINT "scheduled_reminders_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selected_calendars" ADD CONSTRAINT "selected_calendars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selected_calendars" ADD CONSTRAINT "selected_calendars_credential_id_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendees_booking_idx" ON "attendees" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "availabilities_schedule_idx" ON "availabilities" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "booking_references_booking_idx" ON "booking_references" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_uid_idx" ON "bookings" USING btree ("uid");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_idempotency_idx" ON "bookings" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "bookings_user_time_idx" ON "bookings" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credentials_user_idx" ON "credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "destination_calendars_user_idx" ON "destination_calendars" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "destination_calendars_event_idx" ON "destination_calendars" USING btree ("event_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_type_hosts_idx" ON "event_type_hosts" USING btree ("event_type_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_user_slug_idx" ON "event_types" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "event_types_team_idx" ON "event_types" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_team_idx" ON "memberships" USING btree ("user_id","team_id");--> statement-breakpoint
CREATE INDEX "scheduled_reminders_due_idx" ON "scheduled_reminders" USING btree ("send_at","sent_at");--> statement-breakpoint
CREATE INDEX "schedules_user_idx" ON "schedules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "selected_calendars_idx" ON "selected_calendars" USING btree ("user_id","integration","external_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_slug_idx" ON "teams" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification_tokens" USING btree ("identifier");