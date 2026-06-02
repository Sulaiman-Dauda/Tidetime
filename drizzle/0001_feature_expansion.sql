CREATE TYPE "public"."round_robin_mode" AS ENUM('sequential', 'least_busy', 'random');--> statement-breakpoint
ALTER TYPE "public"."membership_role" ADD VALUE 'manager' BEFORE 'member';--> statement-breakpoint
ALTER TYPE "public"."membership_role" ADD VALUE 'provider' BEFORE 'member';--> statement-breakpoint
ALTER TYPE "public"."membership_role" ADD VALUE 'receptionist' BEFORE 'member';--> statement-breakpoint
CREATE TABLE "booking_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"event_type_id" integer NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"kind" varchar(16) DEFAULT 'one_time' NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"invite_email" varchar(255),
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"email" varchar(255) NOT NULL,
	"name" varchar(128) NOT NULL,
	"phone_number" varchar(32),
	"time_zone" varchar(64),
	"notes" text,
	"bookings_count" integer DEFAULT 0 NOT NULL,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"last_booking_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"logo_url" text,
	"brand_color" varchar(9),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "round_robin_mode" "round_robin_mode" DEFAULT 'sequential' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "deposit_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "requires_payment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "status" varchar(16) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider" varchar(32) DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "max_bookings_per_day" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "max_concurrent_bookings" integer;--> statement-breakpoint
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_links_token_idx" ON "booking_links" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_user_email_idx" ON "customers" USING btree ("user_id","email");--> statement-breakpoint
CREATE INDEX "customers_team_idx" ON "customers" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_uid_idx" ON "payments" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "teams_org_idx" ON "teams" USING btree ("organization_id");