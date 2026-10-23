/** Confirmed source records and their validated, immutable query index. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import {
  changeRecord,
  type Dataset,
  datasetSchema,
  type Event,
  eventRecord,
  performanceRecord,
  planRecord,
  recordingRecord,
  workRecord,
} from "./records.js";

function byIdentity<T>(
  values: T[],
  identity: (value: T) => string,
  label: string,
) {
  const result = new Map<string, T>();
  for (const value of values) {
    const key = identity(value);
    if (result.has(key)) throw new Error(`Duplicate ${label}: ${key}`);
    result.set(key, value);
  }
  return result;
}

export function indexDataset(input: unknown) {
  const data = datasetSchema.parse(input);
  const events = byIdentity(data.events, (v) => v.id, "event");
  const works = byIdentity(data.works, (v) => v.id, "work");
  byIdentity(data.performances, (v) => v.id, "performance");
  const recordings = byIdentity(data.recordings, (v) => v.bvid, "recording");
  byIdentity(data.plans, (v) => v.date, "plan day");
  const performancesByWork = Map.groupBy(data.performances, (v) => v.workId);
  const performancesByEvent = Map.groupBy(data.performances, (v) => v.eventId);
  const eventByRecording = linkEventRecordings(data, works);
  validatePerformances(data, events, works);
  return {
    data,
    events,
    works,
    recordings,
    performancesByWork,
    performancesByEvent,
    eventByRecording,
  };
}
function linkEventRecordings(
  data: Dataset,
  works: ReadonlyMap<string, Dataset["works"][number]>,
) {
  for (const event of data.events) validateEvent(event, works);
  const links = data.events.flatMap((event) =>
    (event.recordings ?? []).flatMap((recording) =>
      recording.bvid ? [{ bvid: recording.bvid, event }] : [],
    ),
  );
  const eventByRecording = new Map(
    [...Map.groupBy(links, (link) => link.bvid)].map(([bvid, group]) => [
      bvid,
      group.map((link) => link.event),
    ]),
  );
  return eventByRecording;
}

function validateEvent(
  event: Event,
  works: ReadonlyMap<string, Dataset["works"][number]>,
) {
  if (event.endDate && event.endDate < event.date)
    throw new Error(`Reversed event dates: ${event.id}`);
  for (const workId of event.relatedWorks ?? [])
    if (!works.has(workId))
      throw new Error(`Missing work ${workId} in ${event.id}`);
}

function validatePerformances(
  data: Dataset,
  events: ReadonlyMap<string, Event>,
  works: ReadonlyMap<string, Dataset["works"][number]>,
) {
  for (const item of data.performances) {
    const event = events.get(item.eventId);
    if (!event || !works.has(item.workId))
      throw new Error(`Unlinked performance: ${item.id}`);
    if (["cancelled", "scheduled", "announced"].includes(event.occurrence))
      throw new Error(`Performance linked to non-actual event: ${item.id}`);
    if (item.date !== event.date)
      throw new Error(`Performance date differs from event: ${item.id}`);
  }
}

export type Archive = ReturnType<typeof indexDataset>;

export function readConfirmed(directory: string): Dataset {
  const files = readdirSync(directory).sort();
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(join(directory, name), "utf8"));
  function records<T extends z.ZodType>(
    pattern: RegExp,
    key: string,
    schema: T,
  ): z.infer<T>[] {
    return files
      .filter((name) => pattern.test(name))
      .flatMap(
        (name) =>
          z.object({ [key]: z.array(schema) }).parse(read(name))[key] ?? [],
      );
  }
  return {
    events: records(/^events-\d{4}-\d{2}\.json$/, "events", eventRecord),
    performances: records(
      /^performances-\d{4}-\d{2}\.json$/,
      "performances",
      performanceRecord,
    ),
    works: z.object({ works: z.array(workRecord) }).parse(read("songs.json"))
      .works,
    recordings: records(
      /^recordings-\d{4}\.json$/,
      "recordings",
      recordingRecord,
    ),
    plans: z.object({ days: z.array(planRecord) }).parse(read("plans.json"))
      .days,
    changes: records(
      /^schedule-changes-\d{4}-\d{2}\.json$/,
      "changes",
      changeRecord,
    ),
  };
}
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
