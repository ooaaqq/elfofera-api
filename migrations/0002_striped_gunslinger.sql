CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "plans_date_idx" ON "plans" USING btree ("date");