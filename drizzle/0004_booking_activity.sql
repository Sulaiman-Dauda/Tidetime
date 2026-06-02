CREATE TABLE "booking_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"actor" varchar(255),
	"message" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_activity" ADD CONSTRAINT "booking_activity_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_activity_booking_idx" ON "booking_activity" USING btree ("booking_id","created_at");