CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"end_date" text,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"occurrence" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performances" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"event_id" text,
	"work_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"bvid" text PRIMARY KEY NOT NULL,
	"date" text,
	"title" text NOT NULL,
	"uploader_name" text,
	"uploader_account_id" integer,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"original_artists" jsonb,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "performances_date_idx" ON "performances" USING btree ("date");--> statement-breakpoint
CREATE INDEX "performances_event_idx" ON "performances" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "performances_work_idx" ON "performances" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "recordings_date_idx" ON "recordings" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "recordings_bvid_idx" ON "recordings" USING btree ("bvid");