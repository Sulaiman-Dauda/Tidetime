DROP INDEX "destination_calendars_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "destination_calendars_user_idx" ON "destination_calendars" USING btree ("user_id","integration");--> statement-breakpoint
ALTER TABLE "public"."scheduled_reminders" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."workflows" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."workflow_action";--> statement-breakpoint
CREATE TYPE "public"."workflow_action" AS ENUM('email_attendee', 'email_host');--> statement-breakpoint
ALTER TABLE "public"."scheduled_reminders" ALTER COLUMN "action" SET DATA TYPE "public"."workflow_action" USING "action"::"public"."workflow_action";--> statement-breakpoint
ALTER TABLE "public"."workflows" ALTER COLUMN "action" SET DATA TYPE "public"."workflow_action" USING "action"::"public"."workflow_action";