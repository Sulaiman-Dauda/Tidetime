ALTER TABLE "organizations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "organizations" CASCADE;--> statement-breakpoint
-- IF EXISTS: the CASCADE above already removes this FK (it references the
-- dropped table), so a plain DROP CONSTRAINT always failed and aborted the
-- whole migration — fresh installs could never get past this file.
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "teams_org_idx";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "organization_id";