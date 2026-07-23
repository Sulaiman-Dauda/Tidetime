ALTER TABLE "invites" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invites" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
UPDATE "invites" SET "role" = 'admin' WHERE "role" = 'manager';--> statement-breakpoint
UPDATE "invites" SET "role" = 'member' WHERE "role" = 'provider';--> statement-breakpoint
UPDATE "invites" SET "role" = 'scheduler' WHERE "role" = 'receptionist';--> statement-breakpoint
UPDATE "memberships" SET "role" = 'admin' WHERE "role" = 'manager';--> statement-breakpoint
UPDATE "memberships" SET "role" = 'member' WHERE "role" = 'provider';--> statement-breakpoint
UPDATE "memberships" SET "role" = 'scheduler' WHERE "role" = 'receptionist';--> statement-breakpoint
DROP TYPE "public"."membership_role";--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'scheduler', 'member');--> statement-breakpoint
ALTER TABLE "invites" ALTER COLUMN "role" SET DATA TYPE "public"."membership_role" USING "role"::"public"."membership_role";--> statement-breakpoint
ALTER TABLE "invites" ALTER COLUMN "role" SET DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" SET DATA TYPE "public"."membership_role" USING "role"::"public"."membership_role";--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" SET DEFAULT 'member';
