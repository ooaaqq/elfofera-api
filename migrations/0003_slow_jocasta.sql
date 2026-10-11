CREATE TABLE "schedule_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"action" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "normalized_title" text;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "normalized_artists" text;--> statement-breakpoint
CREATE INDEX "schedule_changes_date_idx" ON "schedule_changes" USING btree ("date");--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;