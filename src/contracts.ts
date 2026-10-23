import { z } from "@hono/zod-openapi";
import {
  changeSlotSchema,
  dateSchema,
  guestSchema,
  memberSchema,
  planEventSchema,
  stageSchema,
} from "./records.js";

export { dateSchema, memberSchema } from "./records.js";

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
    creditedGroup: z.string().nullable(),
    sourceUrls: z.array(z.string()),
  })
  .openapi("Performance");
const eventFields = {
  id: z.string(),
  date: z.string(),
  endDate: z.string().nullable(),
  title: z.string(),
  kind: z.string(),
  occurrence: z.string().nullable(),
  recordingNamedMembers: z.array(z.string()),
  plannedMembers: z.array(z.string()),
  hostMember: z.string().nullable(),
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
  eventIds: z.array(z.string()),
  title: z.string(),
  uploaderName: z.string().nullable(),
  url: z.string(),
});
export const planSchema = z.object({
  id: z.string(),
  date: z.string(),
  restDay: z.boolean().nullable(),
  events: z.array(planEventSchema),
  nonStreamActivities: z.array(z.string()),
  sourceUrls: z.array(z.string()),
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
