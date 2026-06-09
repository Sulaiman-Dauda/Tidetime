ALTER TABLE "organizations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "organizations" CASCADE;--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "teams_org_idx";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "organization_id";