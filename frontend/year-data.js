import { z } from "zod";

import { dateSchema as date, memberSchema as member } from "../src/records.ts";

const manifestSchema = z.object({
  years: z.array(z.string().regex(/^\d{4}$/)).min(1),
  livestreams: z.array(
    z.object({
      id: z.string(),
      date,
      title: z.string(),
      members: z.array(member),
    }),
  ),
  works: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      artists: z.array(z.string()),
      kind: z.string(),
      series: z.string().nullable(),
      performanceCount: z.number().int().nonnegative(),
      publicationCount: z.number().int().nonnegative(),
    }),
  ),
  changes: z.array(
    z.object({
      date,
      action: z.string(),
      members: z.array(member),
      id: z.string(),
      description: z.string().min(1),
    }),
  ),
});
const eventsSchema = z.array(
  z.object({
    id: z.string(),
    date,
    title: z.string(),
    contentType: z.string(),
    dimension: z.enum(["1d", "2d", "3d", "unknown"]),
    isUnannounced: z.boolean(),
    members: z.array(member),
    bvid: z.string().nullable(),
    videoParts: z.array(z.number().int().positive()),
    tracks: z.array(
      z.object({
        id: z.string(),
        workId: z.string(),
        title: z.string(),
        members: z.array(member),
        artists: z.array(z.string()),
        type: z.string(),
        bvid: z.string().nullable(),
        videoParts: z.array(z.number().int().positive()),
      }),
    ),
  }),
);

export async function loadManifest(signal) {
  const response = await fetch("/data/manifest.json", {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  if (!response.ok) throw new Error(`数据清单请求失败（${response.status}）`);
  const parsed = manifestSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("数据清单格式无效");
  return parsed.data;
}

export function createYearLoader(fetchData) {
  const cache = new Map();
  let requestId = 0;
  return async (year) => {
    const id = ++requestId;
    let indexed = cache.get(year);
    if (!indexed) {
      const response = await fetchData(`/data/years/${year}.json`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`加载 ${year} 年数据失败：${response.status}`);
      }
      const parsed = eventsSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error(`${year} 年数据格式无效`);
      const events = parsed.data;
      indexed = {
        events,
        months: Map.groupBy(events, (event) => Number(event.date.slice(5, 7))),
        dates: Map.groupBy(events, (event) => event.date),
      };
      cache.set(year, indexed);
    }
    return { current: id === requestId, indexed };
  };
}
