import { OpenAPIHono } from "@hono/zod-openapi";
import type { Archive } from "./data.js";
import {
  searchWorks,
  timeline,
  workHistory,
  workStatistics,
} from "./queries.js";
import {
  healthRoute,
  historyRoute,
  statisticsRoute,
  timelineRoute,
  worksRoute,
} from "./routes.js";

export function createApp(archive: Archive) {
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
  app.use("/v1/*", async (c, next) => {
    await next();
    if (c.res.ok) c.header("Cache-Control", "public, max-age=60");
  });
  app.openapi(healthRoute, (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ service: "available" as const }, 200);
  });
  app.openapi(worksRoute, (c) =>
    c.json(searchWorks(archive, c.req.valid("query")), 200),
  );
  app.openapi(historyRoute, (c) => {
    const result = workHistory(
      archive,
      c.req.valid("param").workId,
      c.req.valid("query"),
    );
    return result
      ? c.json(result, 200)
      : c.json({ error: "work_not_found" }, 404);
  });
  app.openapi(statisticsRoute, (c) => {
    const result = workStatistics(
      archive,
      c.req.valid("param").workId,
      c.req.valid("query"),
    );
    return result
      ? c.json(result, 200)
      : c.json({ error: "work_not_found" }, 404);
  });
  app.openapi(timelineRoute, (c) =>
    c.json(timeline(archive, c.req.valid("query")), 200),
  );
  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Elfofera API", version: "1.0.0" },
  });
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((error, c) => {
    console.error("Request failed", error.name);
    return c.json({ error: "internal_server_error" }, 500);
  });
  return app;
}
