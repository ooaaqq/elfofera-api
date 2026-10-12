import { z } from "@hono/zod-openapi";
import type { events, performances, recordings, works } from "./db/schema.js";

export const memberSchema = z.enum([
  "luzao",
  "youen",
  "yumo",
  "waner",
  "minuo",
]);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return (
      Number.isFinite(timestamp) &&
      new Date(timestamp).toISOString().slice(0, 10) === value
    );
  }, "Use a real calendar date in YYYY-MM-DD format");
export const pageQuery = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
};
export const pageFields = {
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
  completeness: z.literal("known-records"),
};
export const workSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    originalArtists: z.array(z.string()),
    sourceUrls: z.array(z.string()),
  })
  .openapi("Work");
export const performanceSchema = z
  .object({
    id: z.string(),
    date: z.string(),
    eventId: z.string().nullable(),
    workId: z.string(),
    type: z.string(),
    creditedMembers: z.array(z.string()),
    sourceUrls: z.array(z.string()),
  })
  .openapi("Performance");
const guestSchema = z.object({
  accountId: z.number().int().positive(),
  name: z.string(),
  url: z.url(),
});
const stageSchema = z.object({
  title: z.string(),
  dimension: z.string(),
  titleHours: z.array(z.number().int().min(0).max(23)),
  recordingBvids: z.array(z.string()),
});
const eventFields = {
  id: z.string(),
  date: z.string(),
  endDate: z.string().nullable(),
  title: z.string(),
  kind: z.string(),
  occurrence: z.string().nullable(),
  recordingNamedMembers: z.array(z.string()),
  plannedMembers: z.array(z.string()),
  guests: z.array(guestSchema),
  stages: z.array(stageSchema),
  contentType: z.string().nullable(),
  series: z.string().nullable(),
  dimension: z.string().nullable(),
  isUnannounced: z.boolean().nullable(),
  sourceUrls: z.array(z.string()),
};
export const eventSchema = z.object(eventFields).openapi("Event");
export const historyItemSchema = performanceSchema
  .extend({ event: eventSchema.nullable() })
  .openapi("HistoryItem");
export const timelinePerformanceSchema = performanceSchema.extend({
  work: workSchema.nullable(),
});
export const timelineEventSchema = eventSchema.extend({
  performances: z.array(timelinePerformanceSchema),
});
export const recordingSchema = z.object({
  bvid: z.string(),
  date: z.string().nullable(),
  eventId: z.string().nullable(),
  title: z.string(),
  uploaderName: z.string().nullable(),
  url: z.string(),
});
const planEventSchema = z.object({
  members: z.array(z.string()).default([]),
  plannedTime: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  formatLabel: z.string().nullable().optional(),
  participation: z.string().optional(),
  hostMember: z.string().optional(),
  roomId: z.number().optional(),
});
const planDataSchema = z.object({
  restDay: z.boolean().optional(),
  events: z.array(planEventSchema).default([]),
  nonStreamActivities: z.array(z.string()).default([]),
});
export const planSchema = z.object({
  id: z.string(),
  date: z.string(),
  restDay: z.boolean().nullable(),
  events: z.array(planEventSchema),
  nonStreamActivities: z.array(z.string()),
  sourceUrls: z.array(z.string()),
});
const changeSlotSchema = z.object({
  date: z.string().nullable().optional(),
  plannedTime: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  members: z.array(z.string()).optional(),
});
const changeDataSchema = z.object({
  title: z.string().nullable().optional(),
  member: z.string().nullable().optional(),
  members: z.array(z.string()).optional(),
  from: changeSlotSchema.nullable().optional(),
  to: changeSlotSchema.nullable().optional(),
  replacesPlan: changeSlotSchema.nullable().optional(),
  eventId: z.string().nullable().optional(),
});
export const changeSchema = z.object({
  id: z.string(),
  date: z.string(),
  action: z.string(),
  title: z.string().nullable(),
  members: z.array(z.string()),
  from: changeSlotSchema.nullable(),
  to: changeSlotSchema.nullable(),
  eventId: z.string().nullable(),
  sourceUrls: z.array(z.string()),
});
export const timelineSchema = z
  .object({
    range: z.object({ from: z.string(), through: z.string() }),
    timeZone: z.literal("Asia/Shanghai"),
    completeness: z.literal("known-records"),
    included: z.array(z.string()),
    days: z.array(
      z.object({
        date: z.string(),
        events: z.array(timelineEventSchema),
        performances: z.array(timelinePerformanceSchema),
        recordings: z.array(recordingSchema),
        plans: z.array(planSchema),
        changes: z.array(changeSchema),
      }),
    ),
  })
  .openapi("Timeline");

function sourceUrl(key: string, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (
    ["bvid", "locator", "preferredRecordingBvid"].includes(key) &&
    /^BV[\w]+$/.test(value)
  )
    return `https://www.bilibili.com/video/${value}`;
  if (["dynamicId", "announcementId"].includes(key) && /^\d+$/.test(value))
    return `https://t.bilibili.com/${value}`;
  if (key === "url" && /^https?:\/\//.test(value)) return value;
  return undefined;
}

// Publish source links, never local research paths or evidence excerpts.
export function sourceUrls(data: unknown): string[] {
  const urls = new Set<string>();
  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const url = sourceUrl(key, child);
      if (url) urls.add(url);
      visit(child);
    }
  }
  visit(data);
  return [...urls];
}
const eventDataSchema = z.object({
  recordingNamedMembers: z.array(z.string()).default([]),
  plannedMembers: z.array(z.string()).default([]),
  guests: z.array(guestSchema).default([]),
  stages: z.array(stageSchema).default([]),
  contentType: z.string().optional(),
  series: z.string().optional(),
  dimension: z.string().optional(),
  isUnannounced: z.boolean().optional(),
});
export function eventView(row: typeof events.$inferSelect) {
  const data = eventDataSchema.parse(row.data);
  return {
    id: row.id,
    date: row.date,
    endDate: row.endDate,
    title: row.title,
    kind: row.kind,
    occurrence: row.occurrence,
    recordingNamedMembers: data.recordingNamedMembers,
    plannedMembers: data.plannedMembers,
    guests: data.guests,
    stages: data.stages,
    contentType: data.contentType ?? null,
    series: data.series ?? null,
    dimension: data.dimension ?? null,
    isUnannounced: data.isUnannounced ?? null,
    sourceUrls: sourceUrls(row.data),
  };
}
export function workView(row: typeof works.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    originalArtists:
      z.array(z.string()).nullable().parse(row.originalArtists) ?? [],
    sourceUrls: sourceUrls(row.data),
  };
}
export function performanceView(row: typeof performances.$inferSelect) {
  const data = z
    .object({ creditedMembers: z.array(z.string()).default([]) })
    .parse(row.data);
  return {
    id: row.id,
    date: row.date,
    eventId: row.eventId,
    workId: row.workId,
    type: row.type,
    creditedMembers: data.creditedMembers,
    sourceUrls: sourceUrls(row.data),
  };
}
export function recordingView(row: typeof recordings.$inferSelect) {
  return {
    bvid: row.bvid,
    date: row.date,
    eventId: row.eventId,
    title: row.title,
    uploaderName: row.uploaderName,
    url: `https://www.bilibili.com/video/${row.bvid}`,
  };
}
export function planView(
  row: { id: string; date: string; data: unknown },
  member?: string,
) {
  const data = planDataSchema.parse(row.data);
  return {
    id: row.id,
    date: row.date,
    restDay: data.restDay ?? null,
    events: data.events.filter(
      (item) => !member || item.members.includes(member),
    ),
    nonStreamActivities: data.nonStreamActivities,
    sourceUrls: sourceUrls(row.data),
  };
}
export function changeView(row: {
  id: string;
  date: string;
  action: string;
  data: unknown;
}) {
  const data = changeDataSchema.parse(row.data);
  const members = [
    ...new Set([
      ...(data.members ?? []),
      ...(data.member ? [data.member] : []),
      ...(data.from?.members ?? []),
      ...(data.to?.members ?? []),
      ...(data.replacesPlan?.members ?? []),
    ]),
  ];
  return {
    id: row.id,
    date: row.date,
    action: row.action,
    title: data.title ?? null,
    members,
    from: data.from ?? null,
    to: data.to ?? null,
    eventId: data.eventId ?? null,
    sourceUrls: sourceUrls(row.data),
  };
}
export function page(
  total: number,
  limit: number,
  offset: number,
  length: number,
) {
  return {
    total,
    limit,
    offset,
    hasMore: offset + length < total,
    completeness: "known-records" as const,
  };
}

export const statisticsSchema = z.object({
  work: workSchema,
  range: z.object({
    from: dateSchema.nullable(),
    through: dateSchema.nullable(),
  }),
  countingUnit: z.literal("performance-record"),
  completeness: z.literal("known-records"),
  total: z.number().int().nonnegative(),
  uncredited: z.number().int().nonnegative(),
  byMember: z.array(
    z.object({
      member: memberSchema,
      count: z.number().int().nonnegative(),
      sourceUrls: z.array(z.string()),
    }),
  ),
});

export function performanceStatistics(
  items: z.infer<typeof performanceSchema>[],
) {
  const byMember = memberSchema.options.map((member) => {
    const credited = items.filter((item) =>
      item.creditedMembers.includes(member),
    );
    return {
      member,
      count: credited.length,
      sourceUrls: [
        ...new Set(credited.flatMap((item) => item.sourceUrls)),
      ].slice(0, 3),
    };
  });
  return {
    total: items.length,
    uncredited: items.filter((item) => !item.creditedMembers.length).length,
    byMember,
  };
}
