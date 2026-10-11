import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createDatabase } from "../src/db/client.js";
import { createApp } from "../src/index.js";

const { database, pool } = createDatabase();
const app = createApp(database);
const timelineSchema = z.object({
  days: z.array(
    z.object({
      events: z.array(
        z.object({
          title: z.string(),
          performances: z.array(z.unknown()).optional(),
        }),
      ),
      plans: z.array(z.unknown()),
      recordings: z.array(z.unknown()),
      performances: z.array(z.unknown()),
      changes: z.array(z.unknown()),
    }),
  ),
});
const workSchema = z.object({
  id: z.string(),
  history: z.array(z.unknown()).optional(),
});
const searchSchema = z.object({ items: z.array(workSchema) });
afterAll(async () => {
  await pool.end();
});

describe("imported PostgreSQL queries", () => {
  it("returns events, performances, plans and recordings for debut day", async () => {
    const response = await app.request(
      "/v1/timeline?from=2022-07-24&through=2022-07-24",
    );
    expect(response.status).toBe(200);
    const body = timelineSchema.parse(await response.json());
    expect(body.days).toHaveLength(1);
    const day = body.days[0];
    if (!day) throw new Error("Missing timeline day");
    expect(day.events.length).toBeGreaterThan(0);
    expect(day.plans.length).toBeGreaterThan(0);
    expect(day.recordings.length).toBeGreaterThan(0);
    expect(day.events.some((event) => event.performances?.length)).toBe(true);
  });

  it("queries the later imported years", async () => {
    const response = await app.request(
      "/v1/timeline?from=2026-10-09&through=2026-10-09",
    );
    const body = timelineSchema.parse(await response.json());
    expect(
      body.days[0]?.events.some(
        (event: { title: string }) => event.title === "御姐教妹妹开车",
      ),
    ).toBe(true);
  });

  it("returns seven dates and actual schedule changes", async () => {
    const response = await app.request(
      "/v1/timeline?from=2022-08-08&through=2022-08-14",
    );
    const body = timelineSchema.parse(await response.json());
    expect(body.days).toHaveLength(7);
    expect(
      body.days.some((day: { changes: unknown[] }) => day.changes.length),
    ).toBe(true);
  });

  it("does not lose performances when events are omitted", async () => {
    const response = await app.request(
      "/v1/timeline?from=2022-07-24&through=2022-07-24&include=performances",
    );
    const body = timelineSchema.parse(await response.json());
    const counts = await database.execute(
      sql`SELECT count(*)::int AS count FROM performances WHERE date = '2022-07-24'`,
    );
    expect(body.days[0]?.events).toEqual([]);
    expect(body.days[0]?.performances).toHaveLength(
      Number(counts.rows[0]?.count),
    );
  });

  it("preserves performances without an event association", async () => {
    const rows = await database.execute(
      sql`SELECT date, count(*)::int AS count FROM performances WHERE event_id IS NULL GROUP BY date ORDER BY date LIMIT 1`,
    );
    const source = z
      .object({ date: z.string(), count: z.number() })
      .parse(rows.rows[0]);
    const response = await app.request(
      `/v1/timeline?from=${source.date}&through=${source.date}`,
    );
    const body = timelineSchema.parse(await response.json());
    expect(body.days[0]?.performances).toHaveLength(source.count);
  });

  it("normalizes song title spacing, case and full width input", async () => {
    const paths = ["Lemon", "Ｌｅｍｏｎ", "L e m o n"];
    const results = await Promise.all(
      paths.map(async (q) => {
        const response = await app.request(
          `/v1/works?q=${encodeURIComponent(q)}`,
        );
        expect(response.status).toBe(200);
        return searchSchema
          .parse(await response.json())
          .items.map((work: { id: string }) => work.id);
      }),
    );
    expect(results[0]?.length).toBeGreaterThan(0);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it("returns singer search results and matching complete history", async () => {
    const response = await app.request(
      `/v1/works?artist=${encodeURIComponent("米津")}&include=history`,
    );
    const body = searchSchema.parse(await response.json());
    expect(body.items.length).toBeGreaterThan(0);
    const work = body.items.find((item) => item.history?.length);
    expect(work).toBeDefined();
    if (!work) throw new Error("No work history returned");
    const historyResponse = await app.request(`/v1/works/${work.id}/history`);
    const history = workSchema.parse(await historyResponse.json());
    const counts = await database.execute(
      sql`SELECT count(*)::int AS count FROM performances WHERE work_id = ${work.id}`,
    );
    expect(history.history).toHaveLength(Number(counts.rows[0]?.count));
    expect(history.history).toEqual(work.history);
  });

  it("returns 404 for a missing work and 400 for reversed dates", async () => {
    expect((await app.request("/v1/works/missing/history")).status).toBe(404);
    expect(
      (await app.request("/v1/timeline?from=2026-10-10&through=2026-10-09"))
        .status,
    ).toBe(400);
  });
});
