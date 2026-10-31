import { QueryClient, queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
  detailsSchema,
  endpointsSchema,
  eventsSchema,
  manifestSchema,
  type Work,
} from "./data-contract";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

async function read<T>(
  url: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  if (!response.ok) throw new Error(`请求失败（${response.status}）`);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new Error("数据格式无效，请刷新页面后重试。");
  return parsed.data;
}
export const manifestQuery = queryOptions({
  queryKey: ["manifest"],
  queryFn: ({ signal }) => read("/data/manifest.json", manifestSchema, signal),
});
export const yearQuery = (year: string) =>
  queryOptions({
    queryKey: ["year", year],
    queryFn: ({ signal }) =>
      read(`/data/years/${year}.json`, eventsSchema, signal),
  });
export const workQuery = (work: Work) =>
  queryOptions({
    queryKey: ["work", work.id],
    queryFn: async ({ signal }) => {
      const details = await read(
        `/data/works/${encodeURIComponent(work.id)}.json`,
        detailsSchema,
        signal,
      );
      if (
        details.performances.length !== work.performanceCount ||
        details.publications.length !== work.publicationCount
      )
        throw new Error("作品记录数量与索引不一致，请刷新页面后重试");
      return details;
    },
  });
export const statusQuery = queryOptions({
  queryKey: ["status"],
  queryFn: ({ signal }) =>
    read("/status-api/endpoints/statuses", endpointsSchema, signal),
  staleTime: 0,
  refetchInterval: 30_000,
});
