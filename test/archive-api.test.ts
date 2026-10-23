import { describe, expect, it } from "vitest";
import { z } from "zod";
import { timelineSchema as responseSchema } from "../src/contracts.js";
import { indexDataset, readConfirmed } from "../src/data.js";
import { createApp } from "../src/index.js";

const archive = indexDataset(readConfirmed("data/calendar/confirmed"));
const app = createApp(archive);
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
});
const searchSchema = z.object({ items: z.array(workSchema) });
const historySchema = z.object({
  work: workSchema,
  items: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      creditedMembers: z.array(z.string()),
    }),
  ),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});
describe("confirmed archive queries", () => {
  it("validates compact response contracts across every imported month", async () => {
    for (
      let timestamp = Date.UTC(2022, 6, 1);
      timestamp <= Date.UTC(2026, 9, 1);
    ) {
      const start = new Date(timestamp);
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
      );
      const response = await app.request(
        `/v1/timeline?from=${start.toISOString().slice(0, 10)}&through=${end.toISOString().slice(0, 10)}&include=events,plans,performances,recordings,changes`,
      );
      expect(response.status, start.toISOString()).toBe(200);
      responseSchema.parse(await response.json());
      timestamp = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
    }
  }, 20000);
  it("returns events, performances, plans and recordings for debut day", async () => {
    const response = await app.request(
      "/v1/timeline?from=2022-07-24&through=2022-07-24&include=events,plans,performances,recordings,changes",
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
    expect(body.days[0]?.events).toEqual([]);
    expect(body.days[0]?.performances).toHaveLength(
      archive.data.performances.filter((p) => p.date === "2022-07-24").length,
    );
  });

  it("rejects unlinked performances before serving any requests", () => {
    const data = structuredClone(archive.data);
    const performance = data.performances[0];
    if (!performance) throw new Error("Missing performance fixture");
    performance.eventId = "missing";
    expect(() => indexDataset(data)).toThrow("Unlinked performance");
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

  it("returns artist search results and paginated history", async () => {
    const response = await app.request(
      `/v1/works?artist=${encodeURIComponent("米津")}`,
    );
    const body = searchSchema.parse(await response.json());
    expect(body.items.length).toBeGreaterThan(0);
    const work = body.items[0];
    expect(work).toBeDefined();
    if (!work) throw new Error("No work history returned");
    const historyResponse = await app.request(`/v1/works/${work.id}/history`);
    const history = historySchema.parse(await historyResponse.json());
    expect(history.total).toBe(
      archive.performancesByWork.get(work.id)?.length ?? 0,
    );
    expect(history.items.length).toBe(Math.min(history.total, history.limit));
    expect(history.work.id).toBe(work.id);
    expect(history.hasMore).toBe(history.total > history.limit);
  });

  it("pages history deterministically without missing or repeating records", async () => {
    const selected = [...archive.performancesByWork].find(
      ([, items]) => items.length > 2,
    );
    if (!selected) throw new Error("Missing paginated history fixture");
    const workId = selected[0];
    const first = historySchema.parse(
      await (await app.request(`/v1/works/${workId}/history?limit=1`)).json(),
    );
    const next = historySchema.parse(
      await (
        await app.request(`/v1/works/${workId}/history?limit=1&offset=1`)
      ).json(),
    );
    expect(first.total).toBe(next.total);
    expect(first.hasMore).toBe(true);
    expect(first.items[0]?.id).not.toBe(next.items[0]?.id);
  });

  it("filters credited members and dates without inferring performers from recording uploaders", async () => {
    const p = archive.data.performances.find((p) => p.creditedMembers?.length);
    const member = p?.creditedMembers?.[0];
    if (!p || !member) throw new Error("Missing credited performance fixture");
    const source = {
      work_id: p.workId,
      date: p.date,
      member,
    };
    const response = await app.request(
      `/v1/works/${source.work_id}/history?member=${source.member}&from=${source.date}&through=${source.date}`,
    );
    expect(response.status).toBe(200);
    const result = historySchema.parse(await response.json());
    expect(result.total).toBeGreaterThan(0);
    expect(
      result.items.every(
        (item) =>
          item.date === source.date &&
          item.creditedMembers.includes(source.member),
      ),
    ).toBe(true);
  });

  it("publishes source links without research paths or raw database data", async () => {
    const response = await app.request(
      "/v1/timeline?from=2022-07-24&through=2022-07-24&include=events,performances,recordings,plans,changes",
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("https://www.bilibili.com/video/");
    expect(text).not.toContain("../evidence/");
    expect(text).not.toContain('"data":');
  });

  it("returns 404 for a missing work and 400 for reversed dates", async () => {
    expect((await app.request("/v1/works/missing/history")).status).toBe(404);
    expect(
      (await app.request("/v1/timeline?from=2026-10-10&through=2026-10-09"))
        .status,
    ).toBe(400);
  });
});

it("statistics agree with paginated member histories and honor date filters", async () => {
  const found = await app.request("/v1/works?q=和你在一起");
  const search = searchSchema.parse(await found.json());
  const work = search.items[0];
  if (!work) throw new Error("Missing known work");
  const { statisticsSchema } = await import("../src/contracts.js");
  const response = await app.request(`/v1/works/${work.id}/statistics`);
  expect(response.status).toBe(200);
  const stats = statisticsSchema.parse(await response.json());
  for (const entry of stats.byMember) {
    const history = historySchema.parse(
      await (
        await app.request(
          `/v1/works/${work.id}/history?member=${entry.member}&limit=1`,
        )
      ).json(),
    );
    expect(entry.count).toBe(history.total);
  }
  const filtered = statisticsSchema.parse(
    await (
      await app.request(
        `/v1/works/${work.id}/statistics?from=2023-04-01&through=2023-04-30`,
      )
    ).json(),
  );
  const history = historySchema.parse(
    await (
      await app.request(
        `/v1/works/${work.id}/history?from=2023-04-01&through=2023-04-30&limit=1`,
      )
    ).json(),
  );
  expect(filtered.total).toBe(history.total);
  expect(stats.total).toBeGreaterThanOrEqual(filtered.total);
  expect(
    (
      await app.request(
        `/v1/works/${work.id}/statistics?from=2024-01-02&through=2024-01-01`,
      )
    ).status,
  ).toBe(400);
  expect(
    (await app.request(`/v1/works/${work.id}/statistics?from=2024-02-30`))
      .status,
  ).toBe(400);
  expect((await app.request("/v1/works/missing/statistics")).status).toBe(404);
});
