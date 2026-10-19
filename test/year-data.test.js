import { describe, expect, it, vi } from "vitest";
import { createYearLoader, loadManifest } from "../frontend/year-data.js";

const response = (year) =>
  new Response(
    JSON.stringify([
      {
        id: year,
        date: `${year}-07-24`,
        title: "测试直播",
        contentType: "talk",
        dimension: "2d",
        isUnannounced: false,
        members: ["luzao"],
        bvid: null,
        videoParts: [],
        tracks: [],
      },
    ]),
    {
      headers: { "Content-Type": "application/json" },
    },
  );

describe("year data loading", () => {
  it("marks a slower old request as stale and caches loaded years", async () => {
    let finish;
    const slow = new Promise((resolve) => {
      finish = resolve;
    });
    const fetchData = vi
      .fn()
      .mockReturnValueOnce(slow)
      .mockResolvedValue(response("2026"));
    const load = createYearLoader(fetchData);
    const old = load("2023");
    const recent = await load("2026");
    finish(response("2023"));
    expect(recent.current).toBe(true);
    expect((await old).current).toBe(false);
    expect((await load("2023")).indexed.dates.has("2023-07-24")).toBe(true);
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it("exposes HTTP failures without automatic retry and permits explicit reload", async () => {
    const fetchData = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(response("2024"));
    const load = createYearLoader(fetchData);
    await expect(load("2024")).rejects.toThrow("503");
    expect(fetchData).toHaveBeenCalledOnce();
    expect((await load("2024")).current).toBe(true);
  });

  it("rejects malformed event data without caching it", async () => {
    const fetchData = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "broken" }])))
      .mockResolvedValueOnce(response("2024"));
    const load = createYearLoader(fetchData);
    await expect(load("2024")).rejects.toThrow("数据格式无效");
    expect((await load("2024")).indexed.events[0].title).toBe("测试直播");
  });

  it("rejects invalid JSON instead of caching it", async () => {
    const load = createYearLoader(
      vi.fn().mockResolvedValue(new Response("invalid")),
    );
    await expect(load("2024")).rejects.toThrow();
  });
});

describe("archive manifest loading", () => {
  it("retains the description of an unconfirmed postponed date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            years: ["2026"],
            works: [],
            livestreams: [],
            changes: [
              {
                id: "postponed",
                description: "露早 · 延期：2026-10-18 → 日期待定",
                date: "2026-10-18",
                action: "reschedule",
                members: [],
              },
            ],
          }),
        ),
      ),
    );
    const manifest = await loadManifest(new AbortController().signal);
    expect(manifest.changes[0].description).toContain("日期待定");
  });

  it("rejects an empty year index", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            years: [],
            works: [],
            livestreams: [],
            changes: [],
          }),
        ),
      ),
    );
    await expect(loadManifest(new AbortController().signal)).rejects.toThrow(
      "数据清单格式无效",
    );
  });

  it("exposes an HTTP error without retrying", async () => {
    const fetchData = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchData);
    await expect(loadManifest(new AbortController().signal)).rejects.toThrow(
      "503",
    );
    expect(fetchData).toHaveBeenCalledOnce();
  });
});
