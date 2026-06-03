CREATE TABLE "service_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer,
	"name" varchar(128) NOT NULL,
	"description" text,
	"color" varchar(9),
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_categories_team_idx" ON "service_categories" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;