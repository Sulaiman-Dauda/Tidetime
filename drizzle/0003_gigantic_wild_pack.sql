DROP INDEX "credentials_user_idx";--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "provider" varchar(16) DEFAULT 'google' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "seats_per_slot" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "max_bookings_per_day" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_user_idx" ON "credentials" USING btree ("user_id","provider");