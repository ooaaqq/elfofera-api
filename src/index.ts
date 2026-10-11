import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import type { Database } from "./db/client.js";
import {
  events,
  performances,
  plans,
  recordings,
  scheduleChanges,
  works,
} from "./db/schema.js";

const dateQuery = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const includeQuery = z
  .string()
  .default("events,plans,performances,recordings,changes")
  .transform((value) => new Set(value.split(",").filter(Boolean)));
const dateDistance = (from: string, through: string) =>
  (Date.parse(`${through}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
  86_400_000;
const normalizeSearch = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "");

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Check the service and database connection",
  responses: {
    200: {
      description: "Service and database are available",
      content: {
        "application/json": {
          schema: z.object({
            service: z.literal("available"),
            database: z.literal("available"),
          }),
        },
      },
    },
    503: {
      description: "Database is unavailable",
      content: {
        "application/json": {
          schema: z.object({
            service: z.literal("available"),
            database: z.literal("unavailable"),
          }),
        },
      },
    },
  },
});

const eventsRoute = createRoute({
  method: "get",
  path: "/events",
  request: {
    query: z.object({
      from: z.string().optional(),
      through: z.string().optional(),
      kind: z.string().optional(),
      q: z.string().trim().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  },
  responses: {
    200: {
      description: "Events",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(z.unknown()) }),
        },
      },
    },
  },
});

const worksRoute = createRoute({
  method: "get",
  path: "/works",
  responses: {
    200: {
      description: "Works",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(z.unknown()) }),
        },
      },
    },
  },
});

const performancesRoute = createRoute({
  method: "get",
  path: "/performances",
  request: {
    query: z.object({
      eventId: z.string().optional(),
      workId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  },
  responses: {
    200: {
      description: "Performances",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(z.unknown()) }),
        },
      },
    },
  },
});

const plansRoute = createRoute({
  method: "get",
  path: "/plans",
  request: {
    query: z.object({
      from: z.string().optional(),
      through: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  },
  responses: {
    200: {
      description: "Plans",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(z.unknown()) }),
        },
      },
    },
  },
});

const aiWorksRoute = createRoute({
  method: "get",
  path: "/v1/works",
  summary: "Search works and optionally include performance history",
  request: {
    query: z.object({
      q: z.string().trim().min(1).optional(),
      artist: z.string().trim().min(1).optional(),
      include: z.enum(["history"]).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  },
  responses: {
    200: {
      description: "Matching works with optional performance history",
      content: { "application/json": { schema: z.object({}).passthrough() } },
    },
  },
});

const aiWorkHistoryRoute = createRoute({
  method: "get",
  path: "/v1/works/{workId}/history",
  summary: "List every known performance of one work",
  request: { params: z.object({ workId: z.string().min(1) }) },
  responses: {
    200: {
      description: "Work and its performance history",
      content: { "application/json": { schema: z.object({}).passthrough() } },
    },
    404: {
      description: "Work not found",
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
    },
  },
});

const timelineRoute = createRoute({
  method: "get",
  path: "/v1/timeline",
  summary: "Query all EOE activity in a date range",
  request: {
    query: z.object({
      from: dateQuery,
      through: dateQuery,
      include: includeQuery,
    }),
  },
  responses: {
    200: {
      description: "Events, plans, performances and recordings grouped by day",
      content: { "application/json": { schema: z.object({}).passthrough() } },
    },
    400: {
      description: "Invalid date range",
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
    },
  },
});

async function addHistory(
  database: Database,
  rows: Array<typeof works.$inferSelect>,
) {
  const workIds = rows.map((work) => work.id);
  if (!workIds.length) return rows.map((work) => ({ ...work, history: [] }));
  const historyRows = await database
    .select({ performance: performances, event: events })
    .from(performances)
    .leftJoin(events, eq(performances.eventId, events.id))
    .where(inArray(performances.workId, workIds))
    .orderBy(asc(performances.date));
  const history = Map.groupBy(historyRows, (row) => row.performance.workId);
  return rows.map((work) => ({
    ...work,
    history: (history.get(work.id) ?? []).map(({ performance, event }) => ({
      ...performance,
      event,
    })),
  }));
}

export function createApp(database: Database) {
  const app = new OpenAPIHono();

  app.openapi(healthRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    try {
      await database.execute(sql`SELECT 1`);
      return c.json(
        { service: "available", database: "available" } as const,
        200,
      );
    } catch {
      // Do not log connection URLs or driver errors containing credentials.
      console.error("Database health check failed");
      return c.json(
        { service: "available", database: "unavailable" } as const,
        503,
      );
    }
  });

  app.openapi(eventsRoute, async (c) => {
    const { from, through, kind, q, limit, offset } = c.req.valid("query");
    const rows = await database
      .select()
      .from(events)
      .where(
        and(
          from ? gte(events.date, from) : undefined,
          through ? lte(events.date, through) : undefined,
          kind ? eq(events.kind, kind) : undefined,
          q ? ilike(events.title, `%${q}%`) : undefined,
        ),
      )
      .orderBy(asc(events.date))
      .limit(limit)
      .offset(offset);
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({ items: rows }, 200);
  });

  app.openapi(worksRoute, async (c) => {
    const rows = await database.select().from(works).orderBy(asc(works.title));
    c.header(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=3600",
    );
    return c.json({ items: rows }, 200);
  });

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the bounded search handler combines two optional matching fields and one optional history read.
  app.openapi(aiWorksRoute, async (c) => {
    const { q, artist, include, limit, offset } = c.req.valid("query");
    const term = q ? `%${q}%` : undefined;
    const normalizedTerm = q ? `%${normalizeSearch(q)}%` : undefined;
    const artistTerm = artist ? `%${artist}%` : undefined;
    const normalizedArtistTerm = artist
      ? `%${normalizeSearch(artist)}%`
      : undefined;
    const rows = await database
      .select()
      .from(works)
      .where(
        and(
          term
            ? or(
                ilike(works.title, term),
                normalizedTerm
                  ? ilike(works.normalizedTitle, normalizedTerm)
                  : undefined,
                sql`${works.originalArtists}::text ILIKE ${term}`,
              )
            : undefined,
          artistTerm
            ? or(
                sql`${works.originalArtists}::text ILIKE ${artistTerm}`,
                normalizedArtistTerm
                  ? ilike(works.normalizedArtists, normalizedArtistTerm)
                  : undefined,
              )
            : undefined,
        ),
      )
      .orderBy(asc(works.title))
      .limit(limit)
      .offset(offset);
    const items =
      include === "history" && rows.length
        ? await addHistory(database, rows)
        : rows;
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({ items }, 200);
  });

  app.openapi(aiWorkHistoryRoute, async (c) => {
    const { workId } = c.req.valid("param");
    const [work] = await database
      .select()
      .from(works)
      .where(eq(works.id, workId));
    if (!work) return c.json({ error: "work_not_found" }, 404);
    const [item] = await addHistory(database, [work]);
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json(item, 200);
  });

  app.openapi(performancesRoute, async (c) => {
    const { eventId, workId, limit, offset } = c.req.valid("query");
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    if (eventId) {
      return c.json(
        {
          items: await database
            .select()
            .from(performances)
            .where(eq(performances.eventId, eventId))
            .orderBy(asc(performances.date))
            .limit(limit)
            .offset(offset),
        },
        200,
      );
    }
    if (workId) {
      return c.json(
        {
          items: await database
            .select()
            .from(performances)
            .where(eq(performances.workId, workId))
            .orderBy(asc(performances.date))
            .limit(limit)
            .offset(offset),
        },
        200,
      );
    }
    return c.json(
      {
        items: await database
          .select()
          .from(performances)
          .orderBy(asc(performances.date))
          .limit(limit)
          .offset(offset),
      },
      200,
    );
  });

  app.openapi(plansRoute, async (c) => {
    const { from, through, limit, offset } = c.req.valid("query");
    const rows = await database
      .select()
      .from(plans)
      .where(
        and(
          from ? gte(plans.date, from) : undefined,
          through ? lte(plans.date, through) : undefined,
        ),
      )
      .orderBy(asc(plans.date))
      .limit(limit)
      .offset(offset);
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({ items: rows }, 200);
  });

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the aggregation endpoint keeps its bounded reads and day grouping together.
  app.openapi(timelineRoute, async (c) => {
    const { from, through, include } = c.req.valid("query");
    if (from > through || dateDistance(from, through) > 366)
      return c.json({ error: "invalid_date_range" }, 400);
    const want = (name: string) => include.has(name);
    const [eventRows, planRows, recordingRows, changeRows] = await Promise.all([
      want("events")
        ? database
            .select()
            .from(events)
            .where(and(gte(events.date, from), lte(events.date, through)))
            .orderBy(asc(events.date))
        : Promise.resolve([]),
      want("plans")
        ? database
            .select()
            .from(plans)
            .where(and(gte(plans.date, from), lte(plans.date, through)))
            .orderBy(asc(plans.date))
        : Promise.resolve([]),
      want("recordings")
        ? database
            .select()
            .from(recordings)
            .where(
              and(gte(recordings.date, from), lte(recordings.date, through)),
            )
            .orderBy(asc(recordings.date))
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
            .orderBy(asc(scheduleChanges.date))
        : Promise.resolve([]),
    ]);
    const performanceRows = want("performances")
      ? await database
          .select({ performance: performances, work: works })
          .from(performances)
          .leftJoin(works, eq(performances.workId, works.id))
          .where(
            and(gte(performances.date, from), lte(performances.date, through)),
          )
          .orderBy(asc(performances.date))
      : [];
    const days = new Map<
      string,
      {
        date: string;
        events: unknown[];
        plans: unknown[];
        performances: unknown[];
        recordings: unknown[];
        changes: unknown[];
      }
    >();
    const day = (date: string) => {
      const existing = days.get(date);
      if (existing) return existing;
      const created = {
        date,
        events: [],
        plans: [],
        performances: [],
        recordings: [],
        changes: [],
      };
      days.set(date, created);
      return created;
    };
    for (
      let cursor = Date.parse(`${from}T00:00:00Z`);
      cursor <= Date.parse(`${through}T00:00:00Z`);
      cursor += 86_400_000
    ) {
      day(new Date(cursor).toISOString().slice(0, 10));
    }
    for (const event of eventRows) day(event.date).events.push(event);
    for (const plan of planRows) day(plan.date).plans.push(plan);
    for (const change of changeRows) day(change.date).changes.push(change);
    for (const recording of recordingRows) {
      if (recording.date) day(recording.date).recordings.push(recording);
    }
    for (const row of performanceRows) {
      const event = eventRows.find(
        (item) => item.id === row.performance.eventId,
      );
      if (event) {
        const target = day(event.date).events.find(
          (item) => (item as { id: string }).id === event.id,
        ) as { performances?: unknown[] };
        target.performances ??= [];
        target.performances.push({ ...row.performance, work: row.work });
      } else {
        day(row.performance.date).performances.push({
          ...row.performance,
          work: row.work,
        });
      }
    }
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json(
      {
        range: { from, through },
        included: {
          events: want("events"),
          plans: want("plans"),
          performances: want("performances"),
          recordings: want("recordings"),
          changes: want("changes"),
        },
        completeness: "known-records",
        days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
      },
      200,
    );
  });

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Elfofera API", version: "0.1.0" },
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((_error, c) => {
    console.error("Unhandled request error");
    return c.json({ error: "internal_server_error" }, 500);
  });

  return app;
}
