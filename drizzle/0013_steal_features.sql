CREATE TABLE "travel_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"time_zone" varchar(64) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendees" ADD COLUMN "rsvp_status" varchar(16) DEFAULT 'needs_action' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendees" ADD COLUMN "rsvp_responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_polls" ADD COLUMN "visibility" varchar(16) DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_polls" ADD COLUMN "hide_participants" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "travel_schedules" ADD CONSTRAINT "travel_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "travel_schedules_user_idx" ON "travel_schedules" USING btree ("user_id","start_date");