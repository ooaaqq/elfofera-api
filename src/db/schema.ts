import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    endDate: text("end_date"),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    occurrence: text("occurrence"),
    data: jsonb("data").notNull(),
  },
  (table) => [index("events_date_idx").on(table.date)],
);

export const works = pgTable("works", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  originalArtists: jsonb("original_artists"),
  data: jsonb("data").notNull(),
});

export const performances = pgTable(
  "performances",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    eventId: text("event_id").references(() => events.id),
    workId: text("work_id")
      .notNull()
      .references(() => works.id),
    type: text("type").notNull(),
    data: jsonb("data").notNull(),
  },
  (table) => [
    index("performances_date_idx").on(table.date),
    index("performances_event_idx").on(table.eventId),
    index("performances_work_idx").on(table.workId),
  ],
);

export const recordings = pgTable(
  "recordings",
  {
    bvid: text("bvid").primaryKey(),
    date: text("date"),
    title: text("title").notNull(),
    uploaderName: text("uploader_name"),
    uploaderAccountId: bigint("uploader_account_id", { mode: "number" }),
    data: jsonb("data").notNull(),
  },
  (table) => [
    index("recordings_date_idx").on(table.date),
    uniqueIndex("recordings_bvid_idx").on(table.bvid),
  ],
);

export const plans = pgTable(
  "plans",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    data: jsonb("data").notNull(),
  },
  (table) => [index("plans_date_idx").on(table.date)],
);
