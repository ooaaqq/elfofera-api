import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, count, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import {
  changeView,
  dateSchema,
  eventView,
  historyItemSchema,
  memberSchema,
  page,
  pageFields,
  pageQuery,
  performanceView,
  planView,
  recordingView,
  type timelineEventSchema,
  timelineSchema,
  workSchema,
  workView,
} from "./contracts.js";
import type { Database } from "./db/client.js";
import {
  events,
  performances,
  plans,
  recordings,
  scheduleChanges,
  works,
} from "./db/schema.js";

const normalizeSearch = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
const searchText = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) => normalizeSearch(value).length > 0,
    "Search must contain letters or numbers",
  );
const pattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
const errorSchema = z.object({ error: z.string() });
const jsonResponse = <T extends z.ZodType>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});
const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Check service and database availability",
  responses: {
    200: jsonResponse(
      "Available",
      z.object({
        service: z.literal("available"),
        database: z.literal("available"),
      }),
    ),
    503: jsonResponse(
      "Database unavailable",
      z.object({
        service: z.literal("available"),
        database: z.literal("unavailable"),
      }),
    ),
  },
});
const worksRoute = createRoute({
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
const historyRoute = createRoute({
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
const includeNames = [
  "events",
  "plans",
  "performances",
  "recordings",
  "changes",
];
const timelineRoute = createRoute({
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

export function createApp(database: Database) {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success)
        return c.json(
          {
            error: result.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; "),
          },
          400,
        );
      return undefined;
    },
  });
  app.openapi(healthRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    try {
      await database.execute(sql`SELECT 1`);
      return c.json(
        { service: "available", database: "available" } as const,
        200,
      );
    } catch {
      console.error("Database health check failed");
      return c.json(
        { service: "available", database: "unavailable" } as const,
        503,
      );
    }
  });
  app.openapi(worksRoute, async (c) => {
    const { q, artist, limit, offset } = c.req.valid("query");
    const filter = and(
      q
        ? or(
            ilike(works.normalizedTitle, pattern(normalizeSearch(q))),
            ilike(works.normalizedArtists, pattern(normalizeSearch(q))),
          )
        : undefined,
      artist
        ? ilike(works.normalizedArtists, pattern(normalizeSearch(artist)))
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      database
        .select()
        .from(works)
        .where(filter)
        .orderBy(asc(works.title), asc(works.id))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(works).where(filter),
    ]);
    c.header("Cache-Control", "public, max-age=60");
    return c.json(
      {
        items: rows.map(workView),
        ...page(z.number().parse(totals[0]?.total), limit, offset, rows.length),
      },
      200,
    );
  });
  app.openapi(historyRoute, async (c) => {
    const { workId } = c.req.valid("param");
    const { from, through, member, limit, offset } = c.req.valid("query");
    const [work] = await database
      .select()
      .from(works)
      .where(eq(works.id, workId));
    if (!work) return c.json({ error: "work_not_found" }, 404);
    const filter = and(
      eq(performances.workId, workId),
      from ? gte(performances.date, from) : undefined,
      through ? lte(performances.date, through) : undefined,
      member
        ? sql`${performances.data}->'creditedMembers' @> ${JSON.stringify([member])}::jsonb`
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      database
        .select({ performance: performances, event: events })
        .from(performances)
        .leftJoin(events, eq(performances.eventId, events.id))
        .where(filter)
        .orderBy(asc(performances.date), asc(performances.id))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(performances).where(filter),
    ]);
    c.header("Cache-Control", "public, max-age=60");
    return c.json(
      {
        work: workView(work),
        items: rows.map(({ performance, event }) => ({
          ...performanceView(performance),
          event: event ? eventView(event) : null,
        })),
        ...page(z.number().parse(totals[0]?.total), limit, offset, rows.length),
      },
      200,
    );
  });
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: each bounded read and member filter implements one timeline category.
  app.openapi(timelineRoute, async (c) => {
    const { from, through, include, member } = c.req.valid("query");
    const included = include.split(",");
    const want = (name: string) => included.includes(name);
    // Events are also needed to filter recordings by an attested member association.
    const [eventRows, planRows, recordingRows, changeRows, performanceRows] =
      await Promise.all([
        want("events") || (member && want("recordings"))
          ? database
              .select()
              .from(events)
              .where(and(gte(events.date, from), lte(events.date, through)))
              .orderBy(asc(events.date), asc(events.id))
          : Promise.resolve([]),
        want("plans")
          ? database
              .select()
              .from(plans)
              .where(and(gte(plans.date, from), lte(plans.date, through)))
              .orderBy(asc(plans.date), asc(plans.id))
          : Promise.resolve([]),
        want("recordings")
          ? database
              .select()
              .from(recordings)
              .where(
                and(gte(recordings.date, from), lte(recordings.date, through)),
              )
              .orderBy(asc(recordings.date), asc(recordings.bvid))
          : Promise.resolve([]),
        want("changes")
          ? database
              .select()
              .from(scheduleChanges)
              .where(
                and(
                  gte(scheduleChanges.date, from),
                  lte(scheduleChanges.date, through),
                ),
              )
              .orderBy(asc(scheduleChanges.date), asc(scheduleChanges.id))
          : Promise.resolve([]),
        want("performances")
          ? database
              .select({ performance: performances, work: works })
              .from(performances)
              .leftJoin(works, eq(performances.workId, works.id))
              .where(
                and(
                  gte(performances.date, from),
                  lte(performances.date, through),
                ),
              )
              .orderBy(asc(performances.date), asc(performances.id))
          : Promise.resolve([]),
      ]);
    type Day = z.infer<typeof timelineSchema>["days"][number];
    const days = new Map<string, Day>();
    for (
      let timestamp = Date.parse(from);
      timestamp <= Date.parse(through);
      timestamp += 86400000
    ) {
      const date = new Date(timestamp).toISOString().slice(0, 10);
      days.set(date, {
        date,
        events: [],
        plans: [],
        performances: [],
        recordings: [],
        changes: [],
      });
    }
    function day(date: string) {
      const result = days.get(date);
      if (!result) throw new Error("Query returned a date outside its range");
      return result;
    }
    const selectedEvents = eventRows
      .map(eventView)
      .filter(
        (item) =>
          !member ||
          item.recordingNamedMembers.includes(member) ||
          item.plannedMembers.includes(member),
      );
    const eventMap = new Map<string, z.infer<typeof timelineEventSchema>>();
    for (const item of selectedEvents)
      eventMap.set(item.id, { ...item, performances: [] });
    if (want("events"))
      for (const event of eventMap.values()) day(event.date).events.push(event);
    for (const row of planRows) {
      const plan = planView(row, member);
      if (!member || plan.events.length) day(plan.date).plans.push(plan);
    }
    for (const row of changeRows) {
      const change = changeView(row);
      if (!member || change.members.includes(member))
        day(change.date).changes.push(change);
    }
    for (const row of recordingRows) {
      if (row.date && (!member || (row.eventId && eventMap.has(row.eventId))))
        day(row.date).recordings.push(recordingView(row));
    }
    for (const row of performanceRows) {
      const performance = {
        ...performanceView(row.performance),
        work: row.work ? workView(row.work) : null,
      };
      if (member && !performance.creditedMembers.includes(member)) continue;
      const event = performance.eventId
        ? eventMap.get(performance.eventId)
        : undefined;
      if (want("events") && event) event.performances.push(performance);
      else day(performance.date).performances.push(performance);
    }
    c.header("Cache-Control", "public, max-age=60");
    return c.json(
      {
        range: { from, through },
        timeZone: "Asia/Shanghai" as const,
        completeness: "known-records" as const,
        included,
        days: [...days.values()],
      },
      200,
    );
  });
  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Elfofera API", version: "0.1.0" },
    servers: [{ url: "https://elfofera.com" }],
  });
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((_error, c) => {
    console.error("Unhandled request error");
    return c.json({ error: "internal_server_error" }, 500);
  });
  return app;
}
