import type { z } from "zod";
import type { performanceSchema } from "./contracts.js";
import type {
  Dataset,
  Event,
  Performance,
  Recording,
  Work,
} from "./records.js";
import { memberSchema } from "./records.js";

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
export function eventView(row: Event) {
  return {
    id: row.id,
    date: row.date,
    endDate: row.endDate ?? null,
    title: row.title,
    kind: row.kind,
    occurrence: row.occurrence ?? null,
    recordingNamedMembers: row.recordingNamedMembers ?? [],
    plannedMembers: row.plannedMembers ?? [],
    hostMember: row.hostMember ?? null,
    guests: row.guests ?? [],
    stages: row.stages ?? [],
    contentType: row.contentType ?? null,
    series: row.series ?? null,
    dimension: row.dimension ?? null,
    isUnannounced: row.isUnannounced ?? null,
    sourceUrls: sourceUrls(row),
  };
}
export function workView(row: Work) {
  return {
    id: row.id,
    title: row.title,
    originalArtists: row.originalArtists ?? [],
    sourceUrls: sourceUrls(row),
  };
}
export function performanceView(row: Performance) {
  return {
    id: row.id,
    date: row.date,
    eventId: row.eventId ?? null,
    workId: row.workId,
    type: row.type,
    creditedMembers: row.creditedMembers ?? [],
    creditedGroup: row.creditedGroup ?? null,
    sourceUrls: sourceUrls(row),
  };
}
export function recordingView(row: Recording & { eventIds: string[] }) {
  return {
    bvid: row.bvid,
    date: row.titleSession.date,
    eventIds: row.eventIds,
    title: row.title,
    uploaderName: row.uploader.name ?? null,
    url: `https://www.bilibili.com/video/${row.bvid}`,
  };
}
export function planView(row: Dataset["plans"][number], member?: string) {
  return {
    id: `plan_${row.date}`,
    date: row.date,
    restDay: row.restDay ?? null,
    events: row.events.filter(
      (item) => !member || item.members.includes(member),
    ),
    nonStreamActivities: row.nonStreamActivities,
    sourceUrls: sourceUrls(row),
  };
}
export function changeView(
  row: Dataset["changes"][number] & { id: string; date: string },
) {
  const members = [
    ...new Set([
      ...(row.members ?? []),
      ...(row.member ? [row.member] : []),
      ...(row.from?.members ?? []),
      ...(row.to?.members ?? []),
      ...(row.replacesPlan?.members ?? []),
    ]),
  ];
  return {
    id: row.id,
    date: row.date,
    action: row.action,
    title: row.title ?? null,
    members,
    from: row.from ?? null,
    to: row.to ?? null,
    eventId: row.eventId ?? null,
    sourceUrls: sourceUrls(row),
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
