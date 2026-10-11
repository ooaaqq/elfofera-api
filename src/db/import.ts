import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "./client.js";
import { events, performances, plans, recordings, works } from "./schema.js";

const root = fileURLToPath(
  new URL("../../data/calendar/confirmed/", import.meta.url),
);
const from = "2022-07-01";
const through = "2023-12-31";
const inScope = (date: string | undefined) =>
  date !== undefined && date >= from && date <= through;
const readJson = async <T>(name: string) =>
  JSON.parse(await readFile(join(root, name), "utf8")) as T;

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
const planDays = (
  await readJson<{ days: Array<Record<string, unknown>> }>("plans.json")
).days.filter((day) => inScope(day.date as string | undefined));

const { database, pool } = createDatabase();
try {
  await database.transaction(async (tx) => {
    await tx.delete(performances);
    await tx.delete(recordings);
    await tx.delete(plans);
    await tx.delete(events);
    await tx.delete(works);
    if (workRows.length) {
      await tx.insert(works).values(
        workRows.map((work) => ({
          id: work.id as string,
          title: work.title as string,
          originalArtists: work.originalArtists ?? null,
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
  });
  console.log(
    JSON.stringify({
      events: eventRows.length,
      performances: performanceRows.length,
      works: workRows.length,
      recordings: recordingRows.length,
      plans: planDays.length,
    }),
  );
} finally {
  await pool.end();
}
