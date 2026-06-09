CREATE TABLE "routing_form_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"routed_to" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"routes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fallback" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "routing_form_responses" ADD CONSTRAINT "routing_form_responses_form_id_routing_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."routing_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_forms" ADD CONSTRAINT "routing_forms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_forms" ADD CONSTRAINT "routing_forms_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routing_form_responses_form_idx" ON "routing_form_responses" USING btree ("form_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "routing_forms_slug_idx" ON "routing_forms" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "routing_forms_user_idx" ON "routing_forms" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "routing_forms_team_idx" ON "routing_forms" USING btree ("team_id");