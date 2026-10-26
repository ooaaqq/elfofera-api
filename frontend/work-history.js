import { z } from "zod";
import { memberSchema } from "./records.js";

const historySchema = z.array(
  z.object({
    id: z.string(),
    eventId: z.string(),
    date: z.iso.date(),
    title: z.string(),
    kind: z.string(),
    members: z.array(memberSchema),
    type: z.string(),
    bvid: z.string().nullable(),
    videoParts: z.array(z.number().int().positive()),
  }),
);
const detailsSchema = z.object({
  performances: historySchema,
  publications: z.array(
    z.object({
      id: z.string(),
      date: z.iso.date(),
      title: z.string(),
      members: z.array(memberSchema),
      bvid: z.string().nullable(),
      videoParts: z.array(z.number().int().positive()),
    }),
  ),
});

export async function loadWorkHistory(work, signal) {
  const response = await fetch(
    `/data/works/${encodeURIComponent(work.id)}.json`,
    {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    },
  );
  if (!response.ok) throw new Error(`作品记录请求失败（${response.status}）`);
  const parsed = detailsSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("作品记录格式无效");
  if (parsed.data.performances.length !== work.performanceCount)
    throw new Error("演出记录数量与作品索引不一致，请刷新页面后重试");
  if (parsed.data.publications.length !== work.publicationCount)
    throw new Error("投稿记录数量与作品索引不一致，请刷新页面后重试");
  return parsed.data;
}
