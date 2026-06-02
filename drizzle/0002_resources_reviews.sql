CREATE TYPE "public"."resource_type" AS ENUM('room', 'studio', 'equipment', 'vehicle', 'desk', 'other');--> statement-breakpoint
CREATE TABLE "booking_resources" (
	"booking_id" integer NOT NULL,
	"resource_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_type_resources" (
	"event_type_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"name" varchar(128) NOT NULL,
	"type" "resource_type" DEFAULT 'room' NOT NULL,
	"description" text,
	"capacity" integer DEFAULT 1 NOT NULL,
	"color" varchar(9),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"rating" integer NOT NULL,
	"feedback" text,
	"attendee_email" varchar(255),
	"attendee_name" varchar(128),
	"redirected_to_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "review_request_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "google_review_url" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "review_threshold" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_review_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "review_threshold" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "review_requests_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_type_resources" ADD CONSTRAINT "event_type_resources_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_type_resources" ADD CONSTRAINT "event_type_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_resources_idx" ON "booking_resources" USING btree ("booking_id","resource_id");--> statement-breakpoint
CREATE INDEX "booking_resources_resource_idx" ON "booking_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_type_resources_idx" ON "event_type_resources" USING btree ("event_type_id","resource_id");--> statement-breakpoint
CREATE INDEX "event_type_resources_resource_idx" ON "event_type_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resources_user_idx" ON "resources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resources_team_idx" ON "resources" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_idx" ON "reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "reviews_user_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_team_idx" ON "reviews" USING btree ("team_id");