CREATE TABLE "booking_hosts" (
	"booking_id" integer NOT NULL,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "required_hosts" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_hosts" ADD CONSTRAINT "booking_hosts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_hosts" ADD CONSTRAINT "booking_hosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_hosts_idx" ON "booking_hosts" USING btree ("booking_id","user_id");--> statement-breakpoint
CREATE INDEX "booking_hosts_user_idx" ON "booking_hosts" USING btree ("user_id");