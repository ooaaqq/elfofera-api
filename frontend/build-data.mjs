import { readConfirmed, indexDataset } from "../dist/data.js";
import { videoParts } from "./video.js";
import { buildScheduleChanges } from "./schedule-changes.js";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const confirmed = path.join(root, "data/calendar/confirmed");
const archive = indexDataset(readConfirmed(confirmed));
const { events, performances, changes: scheduleChanges } = archive.data;
const works = archive.works;
const eventById = archive.events;
const histories = new Map();
const publications = new Map();
for (const event of events) {
  if (event.kind !== "publication" || event.occurrence !== "published") continue;
  for (const workId of event.relatedWorks ?? []) {
    if (!works.has(workId)) throw new Error(`Missing work for publication ${event.id}`);
    if (!publications.has(workId)) publications.set(workId, []);
    const asset = event.assets?.[0];
    publications.get(workId).push({
      id: event.id,
      date: event.date,
      title: event.title,
      members: event.creditedMembers ?? [],
      bvid: asset?.bvid ?? null,
      videoParts: videoParts(asset),
    });
  }
}
const tracks = new Map();

for (const performance of performances) {
  if (!performance.eventId || !performance.workId) throw new Error(`Unlinked performance ${performance.id}`);
  const work = works.get(performance.workId);
  const event = eventById.get(performance.eventId);
  const recording = event.recordings?.find(recording => recording.bvid === event.preferredRecordingBvid) ?? event.recordings?.[0];
  const asset = performance.assets?.[0];
  if (!histories.has(work.id)) histories.set(work.id, []);
  histories.get(work.id).push({
    id: performance.id,
    eventId: event.id,
    date: event.date,
    title: event.title,
    kind: event.kind,
    members: performance.creditedMembers ?? [],
    type: performance.type,
    bvid: asset?.bvid ?? event.preferredRecordingBvid ?? recording?.bvid ?? null,
    videoParts: videoParts(asset ?? recording),
  });
  if (!tracks.has(performance.eventId)) tracks.set(performance.eventId, []);

  tracks.get(performance.eventId).push({ id: performance.id, workId: work.id, members: performance.creditedMembers ?? [], title: work.title, artists: work.originalArtists ?? [], type: performance.type, bvid: asset?.bvid ?? null, videoParts: videoParts(asset) });
}
const output = events.filter((event) => {
  if (event.kind !== "livestream" || event.occurrence === "cancelled") return false;
  if (!["recording-attested", "source-attested"].includes(event.occurrence)) throw new Error(`Unconfirmed livestream occurrence: ${event.id}`);
  return true;
}).map((event) => {
  const recording = event.recordings?.find(recording => recording.bvid === event.preferredRecordingBvid) ?? event.recordings?.[0];
  return {
    id: event.id,
    date: event.date,
    title: event.title,
    contentType: event.contentType ?? "unknown",
    dimension: event.dimension ?? "unknown",
    isUnannounced: event.isUnannounced === true,
    members: event.recordingNamedMembers ?? event.plannedMembers ?? [],
    bvid: event.preferredRecordingBvid ?? recording?.bvid ?? null,
    videoParts: videoParts(recording),
    tracks: tracks.get(event.id) ?? [],
  };
});
const changes = buildScheduleChanges(scheduleChanges, events);
const frontendData = path.join(root, "frontend/public/data");
const yearData = path.join(frontendData, "years");
fs.mkdirSync(yearData, { recursive: true });
const historyData = path.join(frontendData, "works");
fs.mkdirSync(historyData, { recursive: true });
for (const work of works.values()) {
  const history = (histories.get(work.id) ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const posts = (publications.get(work.id) ?? []).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(historyData, `${encodeURIComponent(work.id)}.json`), JSON.stringify({ performances: history, publications: posts }));
}
const grouped = Map.groupBy(output, (event) => event.date.slice(0, 4));
for (const [year, yearEvents] of grouped) {
  yearEvents.sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(path.join(yearData, `${year}.json`), JSON.stringify(yearEvents));
}
fs.writeFileSync(
  path.join(frontendData, "manifest.json"),
  JSON.stringify({
    years: [...grouped.keys()].sort(),
    changes,
    livestreams: output.map(({ id, date, title, members }) => ({ id, date, title, members })),
    works: [...works.values()].map((work) => ({
      id: work.id,
      title: work.title,
      artists: work.originalArtists ?? [],
      kind: work.kind ?? "unknown",
      series: work.series ?? null,
      performanceCount: archive.performancesByWork.get(work.id)?.length ?? 0,
      publicationCount: publications.get(work.id)?.length ?? 0,
    })),
  }),
);
for (const [directory, expected] of [
  [yearData, new Set([...grouped.keys()].map((year) => `${year}.json`))],
  [historyData, new Set([...works.keys()].map((id) => `${encodeURIComponent(id)}.json`))],
]) {
  for (const file of fs.readdirSync(directory)) {
    if (!expected.has(file)) fs.rmSync(path.join(directory, file));
  }
}
console.log(`Generated ${output.length} livestreams`);
