import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./client.js";
import {
  events,
  performances,
  plans,
  recordings,
  scheduleChanges,
  works,
} from "./schema.js";

const root = fileURLToPath(
  new URL("../../data/calendar/confirmed/", import.meta.url),
);
const from = "2022-07-01";
const through = "2026-12-31";
const inScope = (date: string | undefined) =>
  date !== undefined && date >= from && date <= through;
const readJson = async <T>(name: string) =>
  JSON.parse(await readFile(join(root, name), "utf8")) as T;
const normalizeSearch = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "");

const eventFiles = (await readdir(root)).filter((name) =>
  /^events-\d{4}-\d{2}\.json$/.test(name),
);
const performanceFiles = (await readdir(root)).filter((name) =>
  /^performances-\d{4}-\d{2}\.json$/.test(name),
);
const eventRows = (
  await Promise.all(
    eventFiles.map((name) =>
      readJson<{ events: Array<Record<string, unknown>> }>(name),
    ),
  )
)
  .flatMap((file) => file.events)
  .filter((event) => inScope(event.date as string | undefined));
const performanceRows = (
  await Promise.all(
    performanceFiles.map((name) =>
      readJson<{ performances: Array<Record<string, unknown>> }>(name),
    ),
  )
)
  .flatMap((file) => file.performances)
  .filter((performance) => inScope(performance.date as string | undefined));
const allWorks = (
  await readJson<{ works: Array<Record<string, unknown>> }>("songs.json")
).works;
const workIds = new Set(
  performanceRows.map((performance) => performance.workId),
);
const workRows = allWorks.filter((work) => workIds.has(work.id));
const recordingFiles = (await readdir(root)).filter((name) =>
  /^recordings-\d{4}\.json$/.test(name),
);
const recordingRows = (
  await Promise.all(
    recordingFiles.map((name) =>
      readJson<{ recordings: Array<Record<string, unknown>> }>(name),
    ),
  )
)
  .flatMap((file) => file.recordings)
  .filter((recording) =>
    inScope((recording.titleSession as { date?: string } | undefined)?.date),
  );
const scheduleChangeFiles = (await readdir(root)).filter((name) =>
  /^schedule-changes-\d{4}-\d{2}\.json$/.test(name),
);
const scheduleChangeRows = (
  await Promise.all(
    scheduleChangeFiles.map((name) =>
      readJson<{ changes: Array<Record<string, unknown>> }>(name),
    ),
  )
)
  .flatMap((file) => file.changes)
  .flatMap((change, index) => {
    const dates = [
      change.date,
      (change.from as { date?: string } | undefined)?.date,
      (change.to as { date?: string } | undefined)?.date,
    ].filter(
      (date): date is string => typeof date === "string" && inScope(date),
    );
    return [...new Set(dates)].map((date, dateIndex) => ({
      id: `change_${date}_${index}_${dateIndex}`,
      date,
      action: change.action as string,
      data: change,
    }));
  });
const planDays = (
  await readJson<{ days: Array<Record<string, unknown>> }>("plans.json")
).days.filter((day) => inScope(day.date as string | undefined));
const bvids = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(bvids);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "bvid" && typeof child === "string" ? [child] : bvids(child),
  );
};
const eventByBvid = new Map(
  eventRows.flatMap((event) =>
    bvids(event).map((bvid) => [bvid, event.id as string] as const),
  ),
);

const { database, pool } = createDatabase();
try {
  await database.transaction(async (tx) => {
    await tx.delete(performances);
    await tx.delete(recordings);
    await tx.delete(scheduleChanges);
    await tx.delete(plans);
    await tx.delete(events);
    await tx.delete(works);
    if (workRows.length) {
      await tx.insert(works).values(
        workRows.map((work) => ({
          id: work.id as string,
          title: work.title as string,
          normalizedTitle: normalizeSearch(work.title as string),
          originalArtists: work.originalArtists ?? null,
          normalizedArtists: Array.isArray(work.originalArtists)
            ? normalizeSearch(work.originalArtists.join(" "))
            : null,
          data: work,
        })),
      );
    }
    if (eventRows.length) {
      await tx.insert(events).values(
        eventRows.map((event) => ({
          id: event.id as string,
          date: event.date as string,
          endDate: (event.endDate as string | undefined) ?? null,
          title: event.title as string,
          kind: event.kind as string,
          occurrence: (event.occurrence as string | undefined) ?? null,
          data: event,
        })),
      );
    }
    if (performanceRows.length) {
      await tx.insert(performances).values(
        performanceRows.map((performance) => ({
          id: performance.id as string,
          date: performance.date as string,
          eventId: (performance.eventId as string | undefined) ?? null,
          workId: performance.workId as string,
          type: performance.type as string,
          data: performance,
        })),
      );
    }
    if (recordingRows.length) {
      await tx.insert(recordings).values(
        recordingRows.map((recording) => {
          const uploader = recording.uploader as
            | { accountId?: number; name?: string }
            | undefined;
          return {
            bvid: recording.bvid as string,
            date:
              (recording.titleSession as { date?: string } | undefined)?.date ??
              null,
            eventId: eventByBvid.get(recording.bvid as string) ?? null,
            title: recording.title as string,
            uploaderName: uploader?.name ?? null,
            uploaderAccountId: uploader?.accountId ?? null,
            data: recording,
          };
        }),
      );
    }
    if (planDays.length) {
      await tx.insert(plans).values(
        planDays.map((day) => ({
          id: `plan_${day.date as string}`,
          date: day.date as string,
          data: day,
        })),
      );
    }
    if (scheduleChangeRows.length) {
      await tx.insert(scheduleChanges).values(scheduleChangeRows);
    }
  });
  console.log(
    JSON.stringify({
      events: eventRows.length,
      performances: performanceRows.length,
      works: workRows.length,
      recordings: recordingRows.length,
      plans: planDays.length,
      scheduleChanges: scheduleChangeRows.length,
    }),
  );
} finally {
  await pool.end();
}
