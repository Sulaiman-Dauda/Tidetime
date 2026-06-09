CREATE TABLE "meeting_poll_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_poll_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	"voter_name" varchar(128) NOT NULL,
	"voter_email" varchar(255) NOT NULL,
	"choice" varchar(12) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer,
	"token" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" text,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"time_zone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"finalized_option_id" integer,
	"finalized_booking_uid" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_poll_options" ADD CONSTRAINT "meeting_poll_options_poll_id_meeting_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."meeting_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_poll_votes" ADD CONSTRAINT "meeting_poll_votes_poll_id_meeting_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."meeting_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_poll_votes" ADD CONSTRAINT "meeting_poll_votes_option_id_meeting_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."meeting_poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_polls" ADD CONSTRAINT "meeting_polls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_polls" ADD CONSTRAINT "meeting_polls_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_poll_options_poll_idx" ON "meeting_poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "meeting_poll_votes_poll_idx" ON "meeting_poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_poll_votes_unique_idx" ON "meeting_poll_votes" USING btree ("option_id","voter_email");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_polls_token_idx" ON "meeting_polls" USING btree ("token");--> statement-breakpoint
CREATE INDEX "meeting_polls_user_idx" ON "meeting_polls" USING btree ("user_id");