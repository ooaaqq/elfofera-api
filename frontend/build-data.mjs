import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const confirmed = path.join(root, "data/calendar/confirmed");
const events = [];
const scheduleChanges = [];
const performances = [];
const works = new Map();
for (const file of fs.readdirSync(confirmed)) {
  if (/^events-\d{4}-\d{2}\.json$/.test(file)) events.push(...JSON.parse(fs.readFileSync(path.join(confirmed, file), "utf8")).events);
  if (/^schedule-changes-\d{4}-\d{2}\.json$/.test(file)) scheduleChanges.push(...JSON.parse(fs.readFileSync(path.join(confirmed, file), "utf8")).changes);
  if (/^performances-\d{4}-\d{2}\.json$/.test(file)) performances.push(...JSON.parse(fs.readFileSync(path.join(confirmed, file), "utf8")).performances);
}
for (const work of JSON.parse(fs.readFileSync(path.join(confirmed, "songs.json"), "utf8")).works) works.set(work.id, work);
const tracks = new Map();
for (const performance of performances) {
  if (!performance.eventId || !performance.workId) continue;
  const work = works.get(performance.workId);
  if (!work) continue;
  if (!tracks.has(performance.eventId)) tracks.set(performance.eventId, []);
  tracks.get(performance.eventId).push({ workId: work.id, members: performance.creditedMembers ?? [], title: work.title, artists: work.originalArtists ?? [], type: performance.type, bvid: performance.assets?.[0]?.bvid ?? null });
}
const output = events.filter((event) => event.kind === "livestream").map((event) => ({
  id: event.id,
  date: event.date,
  title: event.title,
  contentType: event.contentType ?? "unknown",
  dimension: event.dimension ?? "unknown",
  isUnannounced: event.isUnannounced === true,
  members: event.recordingNamedMembers ?? event.plannedMembers ?? [],
  bvid: event.preferredRecordingBvid ?? event.recordings?.[0]?.bvid ?? null,
  tracks: tracks.get(event.id) ?? [],
}));
const changes = scheduleChanges.flatMap(change => {
  const dates = [change.date, change.from?.date, change.to?.date].filter(Boolean);
  return [...new Set(dates)].map(date => ({ date, action: change.action, title: change.title === "日程变更" ? undefined : change.title ?? change.from?.title ?? change.to?.title, members: change.members ?? (change.member ? [change.member] : []), plannedTime: change.plannedTime, from: change.from, to: change.to, fromFormat: change.fromFormat, toFormat: change.toFormat }));
});
const frontendData = path.join(root, "frontend/public/data");
const yearData = path.join(frontendData, "years");
fs.rmSync(frontendData, { recursive: true, force: true });
fs.mkdirSync(yearData, { recursive: true });
const grouped = Map.groupBy(output, (event) => event.date.slice(0, 4));
for (const [year, yearEvents] of grouped) {
  yearEvents.sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(path.join(yearData, `${year}.json`), JSON.stringify(yearEvents));
}
fs.writeFileSync(
  path.join(frontendData, "manifest.json"),
  JSON.stringify({ years: [...grouped.keys()].sort(), changes }),
);
console.log(`Generated ${output.length} livestreams`);
