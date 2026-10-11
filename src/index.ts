import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { asc, eq, sql } from "drizzle-orm";
import type { Database } from "./db/client.js";
import { events, performances, plans, works } from "./db/schema.js";

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
    const { from, through } = c.req.valid("query");
    const rows = await database
      .select()
      .from(events)
      .where(
        from && through
          ? sql`${events.date} >= ${from} AND ${events.date} <= ${through}`
          : undefined,
      )
      .orderBy(asc(events.date));
    return c.json({ items: rows }, 200);
  });

  app.openapi(worksRoute, async (c) =>
    c.json(
      { items: await database.select().from(works).orderBy(asc(works.title)) },
      200,
    ),
  );

  app.openapi(performancesRoute, async (c) => {
    const { eventId, workId } = c.req.valid("query");
    if (eventId) {
      return c.json(
        {
          items: await database
            .select()
            .from(performances)
            .where(eq(performances.eventId, eventId))
            .orderBy(asc(performances.date)),
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
            .orderBy(asc(performances.date)),
        },
        200,
      );
    }
    return c.json(
      {
        items: await database
          .select()
          .from(performances)
          .orderBy(asc(performances.date)),
      },
      200,
    );
  });

  app.openapi(plansRoute, async (c) => {
    const { from, through } = c.req.valid("query");
    const rows = await database
      .select()
      .from(plans)
      .where(
        from && through
          ? sql`${plans.date} >= ${from} AND ${plans.date} <= ${through}`
          : undefined,
      )
      .orderBy(asc(plans.date));
    return c.json({ items: rows }, 200);
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
