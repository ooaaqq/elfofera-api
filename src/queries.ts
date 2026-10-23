import type { z } from "zod";
import { type Archive, normalizeSearch } from "./data.js";
import type {
  historyRoute,
  statisticsRoute,
  timelineRoute,
  worksRoute,
} from "./routes.js";
import {
  changeView,
  eventView,
  page,
  performanceStatistics,
  performanceView,
  planView,
  recordingView,
  workView,
} from "./views.js";

export function searchWorks(
  archive: Archive,
  query: z.infer<typeof worksRoute.request.query>,
) {
  const { q, artist, limit, offset } = query;
  const selected = archive.data.works
    .filter(
      (work) =>
        (!q ||
          normalizeSearch(work.title).includes(normalizeSearch(q)) ||
          normalizeSearch((work.originalArtists ?? []).join(" ")).includes(
            normalizeSearch(q),
          )) &&
        (!artist ||
          normalizeSearch((work.originalArtists ?? []).join(" ")).includes(
            normalizeSearch(artist),
          )),
    )
    .toSorted(
      (a, b) =>
        a.title.localeCompare(b.title, "zh-CN") || a.id.localeCompare(b.id),
    );
  const items = selected.slice(offset, offset + limit).map(workView);
  return { items, ...page(selected.length, limit, offset, items.length) };
}
export function workHistory(
  archive: Archive,
  workId: string,
  query: z.infer<typeof historyRoute.request.query>,
) {
  const work = archive.works.get(workId);
  if (!work) return null;
  const { from, through, member, limit, offset } = query;
  const selected = (archive.performancesByWork.get(workId) ?? [])
    .filter(
      (p) =>
        (!from || p.date >= from) &&
        (!through || p.date <= through) &&
        (!member || p.creditedMembers?.includes(member)),
    )
    .toSorted(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  const items = selected.slice(offset, offset + limit).map((p) => ({
    ...performanceView(p),
    // biome-ignore lint/style/noNonNullAssertion: indexDataset verifies every performance event reference.
    event: eventView(archive.events.get(p.eventId)!),
  }));
  return {
    work: workView(work),
    items,
    ...page(selected.length, limit, offset, items.length),
  };
}
export function workStatistics(
  archive: Archive,
  workId: string,
  query: z.infer<typeof statisticsRoute.request.query>,
) {
  const work = archive.works.get(workId);
  if (!work) return null;
  const { from, through } = query;
  const selected = (archive.performancesByWork.get(workId) ?? [])
    .filter((p) => (!from || p.date >= from) && (!through || p.date <= through))
    .toSorted(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  return {
    work: workView(work),
    range: { from: from ?? null, through: through ?? null },
    countingUnit: "performance-record" as const,
    completeness: "known-records" as const,
    ...performanceStatistics(selected.map(performanceView)),
  };
}
function timelineRows(
  archive: Archive,
  query: z.infer<typeof timelineRoute.request.query>,
) {
  const { from, through, include } = query;
  const included = include.split(",");
  const want = (name: string) => included.includes(name);
  const within = (date: string) => date >= from && date <= through;
  const eventRows = archive.data.events
    .filter((e) => within(e.date))
    .toSorted(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  const planRows = want("plans")
    ? archive.data.plans.filter((p) => within(p.date))
    : [];
  const recordingRows = want("recordings")
    ? archive.data.recordings
        .filter((r) => within(r.titleSession.date))
        .map((r) => ({
          ...r,
          eventIds: (archive.eventByRecording.get(r.bvid) ?? []).map(
            (e) => e.id,
          ),
        }))
    : [];
  const changeRows = want("changes")
    ? archive.data.changes.flatMap((change, index) =>
        [
          ...new Set(
            [change.date, change.from?.date, change.to?.date].filter(
              (d): d is string => typeof d === "string" && within(d),
            ),
          ),
        ].map((date) => ({ ...change, id: `change_${index}_${date}`, date })),
      )
    : [];
  const performanceRows = want("performances")
    ? archive.data.performances
        .filter((p) => within(p.date))
        .map((p) => ({
          performance: p,
          // biome-ignore lint/style/noNonNullAssertion: indexDataset verifies every performance work reference.
          work: archive.works.get(p.workId)!,
        }))
    : [];
  return { eventRows, planRows, recordingRows, changeRows, performanceRows };
}
function timelineContent(
  archive: Archive,
  query: z.infer<typeof timelineRoute.request.query>,
) {
  const { member, include } = query;
  const included = new Set(include.split(","));
  const rows = timelineRows(archive, query);
  const events = rows.eventRows
    .map(eventView)
    .filter((event) => matchesEventMember(event, member));
  const eventIds = new Set(events.map((event) => event.id));
  const performances = rows.performanceRows
    .map((row) => ({
      ...performanceView(row.performance),
      work: workView(row.work),
    }))
    .filter(
      (performance) => !member || performance.creditedMembers.includes(member),
    );
  const byEvent = Map.groupBy(
    performances,
    (performance) => performance.eventId,
  );
  const plans = rows.planRows
    .map((row) => planView(row, member))
    .filter((plan) => !member || plan.events.length > 0);
  const recordings = rows.recordingRows
    .filter((row) => !member || row.eventIds.some((id) => eventIds.has(id)))
    .map(recordingView);
  const changes = rows.changeRows
    .map(changeView)
    .filter((change) => !member || change.members.includes(member));
  return {
    events: included.has("events")
      ? events.map((event) => ({
          ...event,
          performances: byEvent.get(event.id) ?? [],
        }))
      : [],
    performances: performances.filter(
      (performance) =>
        !included.has("events") || !eventIds.has(performance.eventId),
    ),
    plans,
    recordings,
    changes,
  };
}
function matchesEventMember(
  event: ReturnType<typeof eventView>,
  member: z.infer<typeof timelineRoute.request.query>["member"],
) {
  return (
    !member ||
    event.recordingNamedMembers.includes(member) ||
    event.hostMember === member ||
    event.plannedMembers.includes(member)
  );
}
export function timeline(
  archive: Archive,
  query: z.infer<typeof timelineRoute.request.query>,
) {
  const content = timelineContent(archive, query);
  const grouped = {
    events: Map.groupBy(content.events, (item) => item.date),
    performances: Map.groupBy(content.performances, (item) => item.date),
    plans: Map.groupBy(content.plans, (item) => item.date),
    recordings: Map.groupBy(content.recordings, (item) => item.date),
    changes: Map.groupBy(content.changes, (item) => item.date),
  };
  const { from, through, include } = query;
  const days = Array.from(
    { length: (Date.parse(through) - Date.parse(from)) / 86400000 + 1 },
    (_, index) => {
      const date = new Date(Date.parse(from) + index * 86400000)
        .toISOString()
        .slice(0, 10);
      return {
        date,
        events: grouped.events.get(date) ?? [],
        performances: grouped.performances.get(date) ?? [],
        plans: grouped.plans.get(date) ?? [],
        recordings: grouped.recordings.get(date) ?? [],
        changes: grouped.changes.get(date) ?? [],
      };
    },
  );
  return {
    range: { from, through },
    timeZone: "Asia/Shanghai" as const,
    completeness: "known-records" as const,
    included: include.split(","),
    days,
  };
}
