import { createRoute, z } from "@hono/zod-openapi";
import {
  dateSchema,
  historyItemSchema,
  memberSchema,
  pageFields,
  pageQuery,
  statisticsSchema,
  timelineSchema,
  workSchema,
} from "./contracts.js";
import { normalizeSearch } from "./data.js";

const searchText = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) => normalizeSearch(value).length > 0,
    "Search must contain letters or numbers",
  );
const errorSchema = z.object({ error: z.string() });
const jsonResponse = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});
export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: jsonResponse(
      "Validated archive available",
      z.object({ service: z.literal("available") }),
    ),
  },
});
export const worksRoute = createRoute({
  method: "get",
  path: "/v1/works",
  summary: "Search songs by title or original artist",
  request: {
    query: z
      .object({
        q: searchText.optional(),
        artist: searchText.optional(),
        ...pageQuery,
      })
      .strict(),
  },
  responses: {
    200: jsonResponse(
      "Known matching works",
      z.object({ items: z.array(workSchema), ...pageFields }),
    ),
    400: jsonResponse("Invalid query", errorSchema),
  },
});
const historyQuery = z
  .object({
    from: dateSchema.optional(),
    through: dateSchema.optional(),
    member: memberSchema.optional(),
    ...pageQuery,
  })
  .strict()
  .refine(
    (value) => !value.from || !value.through || value.from <= value.through,
    "from must precede through",
  );
export const historyRoute = createRoute({
  method: "get",
  path: "/v1/works/{workId}/history",
  summary:
    "List known performances of one song, with optional date and credited-member filters",
  request: {
    params: z.object({ workId: z.string().min(1).max(200) }),
    query: historyQuery,
  },
  responses: {
    200: jsonResponse(
      "Paginated known performance history",
      z.object({
        work: workSchema,
        items: z.array(historyItemSchema),
        ...pageFields,
      }),
    ),
    400: jsonResponse("Invalid query", errorSchema),
    404: jsonResponse("Work not found", errorSchema),
  },
});
export const statisticsRoute = createRoute({
  method: "get",
  path: "/v1/works/{workId}/statistics",
  summary: "Count known performance records and explicitly credited members",
  request: {
    params: z.object({ workId: z.string().min(1).max(200) }),
    query: z
      .object({ from: dateSchema.optional(), through: dateSchema.optional() })
      .strict()
      .refine(
        (value) => !value.from || !value.through || value.from <= value.through,
        "from must precede through",
      ),
  },
  responses: {
    200: jsonResponse(
      "Performance counts, without reading history pages",
      statisticsSchema,
    ),
    400: jsonResponse("Invalid query", errorSchema),
    404: jsonResponse("Work not found", errorSchema),
  },
});
const includeNames = [
  "events",
  "plans",
  "performances",
  "recordings",
  "changes",
];
export const timelineRoute = createRoute({
  method: "get",
  path: "/v1/timeline",
  summary: "Query up to 31 days of EOE activity in Asia/Shanghai",
  request: {
    query: z
      .object({
        from: dateSchema,
        through: dateSchema,
        member: memberSchema.optional(),
        include: z
          .string()
          .default("events,plans,recordings,changes")
          .refine((value) => {
            const names = value.split(",");
            return (
              names.every((name) => includeNames.includes(name)) &&
              new Set(names).size === names.length
            );
          }, "include must contain distinct supported categories"),
      })
      .strict()
      .refine((value) => {
        const days =
          (Date.parse(value.through) - Date.parse(value.from)) / 86400000;
        return days >= 0 && days < 31;
      }, "Use an ordered range of at most 31 days"),
  },
  responses: {
    200: jsonResponse("Known activity, grouped by date", timelineSchema),
    400: jsonResponse("Invalid query", errorSchema),
  },
});
