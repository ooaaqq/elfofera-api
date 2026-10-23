/** Confirmed source shapes. Evidence metadata remains attached to source records. */
import { z } from "zod";
export const memberSchema = z.enum([
  "luzao",
  "youen",
  "yumo",
  "waner",
  "minuo",
]);
export const dateSchema = z.iso.date();
const id = z.string().min(1);
const bvid = z.string().regex(/^BV[0-9A-Za-z]{10}$/);
const members = z.array(memberSchema);
const asset = z.looseObject({
  bvid: bvid.optional(),
  partNumbers: z.array(z.number().int().positive()).optional(),
});
export const guestSchema = z.object({
  accountId: z.number().int().positive(),
  name: z.string(),
  url: z.url(),
});
export const stageSchema = z.object({
  title: z.string(),
  dimension: z.string(),
  titleHours: z.array(z.number().int().min(0).max(23)),
  recordingBvids: z.array(z.string()),
});
export const planEventSchema = z.object({
  members: z.array(z.string()).default([]),
  plannedTime: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  formatLabel: z.string().nullable().optional(),
  participation: z.string().optional(),
  hostMember: z.string().optional(),
  roomId: z.number().optional(),
});
export const planDataSchema = z.object({
  restDay: z.boolean().optional(),
  events: z.array(planEventSchema).default([]),
  nonStreamActivities: z.array(z.string()).default([]),
});
export const changeSlotSchema = z.object({
  date: dateSchema.nullable().optional(),
  plannedTime: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  members: z.array(z.string()).optional(),
});
export const changeDataSchema = z.object({
  title: z.string().nullable().optional(),
  member: z.string().nullable().optional(),
  members: z.array(z.string()).optional(),
  from: changeSlotSchema.nullable().optional(),
  to: changeSlotSchema.nullable().optional(),
  replacesPlan: changeSlotSchema.nullable().optional(),
  eventId: z.string().nullable().optional(),
});
export const eventRecord = z.looseObject({
  id,
  date: dateSchema,
  endDate: dateSchema.optional(),
  title: z.string().min(1),
  kind: id,
  occurrence: id,
  recordingNamedMembers: members.optional(),
  plannedMembers: members.optional(),
  creditedMembers: members.optional(),
  hostMember: memberSchema.optional(),
  relatedWorks: z.array(id).optional(),
  recordings: z.array(asset).optional(),
  assets: z.array(asset).optional(),
  preferredRecordingBvid: bvid.optional(),
  contentType: z.string().optional(),
  dimension: z.string().optional(),
  series: z.string().optional(),
  isUnannounced: z.boolean().optional(),
  guests: z.array(guestSchema).optional(),
  stages: z.array(stageSchema).optional(),
});
export const workRecord = z.looseObject({
  id,
  title: id,
  originalArtists: z.array(id).optional(),
  kind: z.string().optional(),
  series: z.string().optional(),
});
export const performanceRecord = z.looseObject({
  id,
  date: dateSchema,
  eventId: id,
  workId: id,
  type: id,
  creditedMembers: members.optional(),
  creditedGroup: z.string().optional(),
  assets: z.array(asset),
});
export const recordingRecord = z.looseObject({
  bvid,
  title: id,
  titleSession: z.looseObject({ date: dateSchema }),
  uploader: z.looseObject({
    name: z.string().optional(),
    accountId: z.number().int().positive().optional(),
  }),
});
export const planRecord = z.looseObject({
  ...planDataSchema.shape,
  date: dateSchema,
});
export const changeRecord = z.looseObject({
  ...changeDataSchema.shape,
  action: id,
  date: dateSchema.optional(),
});
export const datasetSchema = z.object({
  events: z.array(eventRecord),
  works: z.array(workRecord),
  performances: z.array(performanceRecord),
  recordings: z.array(recordingRecord),
  plans: z.array(planRecord),
  changes: z.array(changeRecord),
});
export type Dataset = z.infer<typeof datasetSchema>;
export type Event = z.infer<typeof eventRecord>;
export type Work = z.infer<typeof workRecord>;
export type Performance = z.infer<typeof performanceRecord>;
export type Recording = z.infer<typeof recordingRecord>;
