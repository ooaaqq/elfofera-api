import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkHistory } from "../frontend/work-history.js";

const records = ["2023-04-01", "2026-01-01"].map((date, index) => ({
  id: `performance-${index}`,
  eventId: `event-${index}`,
  date,
  title: "演出",
  kind: index === 0 ? "publication" : "livestream",
  members: ["luzao"],
  type: "singing",
  bvid: null,
  videoParts: [],
}));
const details = { performances: records, publications: [] };
const work = { id: "a/b", performanceCount: 2, publicationCount: 0 };
const signal = () => new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());

describe("complete work history", () => {
  it("retains performances across years and event types", async () => {
    const fetchData = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(details)));
    vi.stubGlobal("fetch", fetchData);
    expect(await loadWorkHistory(work, signal())).toEqual(details);
    expect(fetchData.mock.calls[0][0]).toBe("/data/works/a%2Fb.json");
  });

  it("exposes a count mismatch instead of presenting incomplete history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(details))),
    );
    await expect(
      loadWorkHistory({ ...work, performanceCount: 17 }, signal()),
    ).rejects.toThrow("数量与作品索引不一致");
  });

  it("rejects invalid history data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify([{ id: "invalid" }]))),
    );
    await expect(loadWorkHistory(work, signal())).rejects.toThrow("格式无效");
  });

  it("exposes failed requests without automatic retry", async () => {
    const fetchData = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchData);
    await expect(loadWorkHistory(work, signal())).rejects.toThrow("503");
    expect(fetchData).toHaveBeenCalledOnce();
  });

  it("loads publication-only works without turning their uploads into performances", async () => {
    const data = {
      performances: [],
      publications: [
        {
          id: "publication",
          date: "2023-06-11",
          title: "Beautiful World",
          members: [],
          bvid: "BV14M4y1Y7bN",
          videoParts: [2, 3],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(data))),
    );
    expect(
      await loadWorkHistory(
        { ...work, performanceCount: 0, publicationCount: 1 },
        signal(),
      ),
    ).toEqual(data);
  });

  it("rejects missing publications instead of showing a misleading empty list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(details))),
    );
    await expect(
      loadWorkHistory({ ...work, publicationCount: 1 }, signal()),
    ).rejects.toThrow("投稿记录数量与作品索引不一致");
  });
});
