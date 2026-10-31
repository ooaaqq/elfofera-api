import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { manifestQuery, queryClient, yearQuery } from "../frontend/data.ts";

const loadManifest = () => queryClient.fetchQuery(manifestQuery);

afterEach(() => {
  queryClient.clear();
  mock.restore();
});

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
  it("keeps year results isolated and caches successful requests", async () => {
    let finish;
    const slow = new Promise((resolve) => {
      finish = resolve;
    });
    const fetchData = spyOn(globalThis, "fetch")
      .mockReturnValueOnce(slow)
      .mockResolvedValue(response("2026"));
    const old = queryClient.fetchQuery(yearQuery("2023"));
    expect((await queryClient.fetchQuery(yearQuery("2026")))[0].id).toBe(
      "2026",
    );
    finish(response("2023"));
    expect((await old)[0].id).toBe("2023");
    await queryClient.fetchQuery(yearQuery("2023"));
    expect(fetchData).toHaveBeenCalledTimes(2);
  });
  it("exposes HTTP failures without automatic retry and permits explicit reload", async () => {
    const fetchData = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(response("2024"));
    await expect(queryClient.fetchQuery(yearQuery("2024"))).rejects.toThrow(
      "503",
    );
    expect(fetchData).toHaveBeenCalledOnce();
    expect((await queryClient.fetchQuery(yearQuery("2024")))[0].title).toBe(
      "测试直播",
    );
  });
  it("rejects malformed event data without caching it", async () => {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json([{ id: "broken" }]))
      .mockResolvedValueOnce(response("2024"));
    await expect(queryClient.fetchQuery(yearQuery("2024"))).rejects.toThrow();
    expect(
      queryClient.getQueryData(yearQuery("2024").queryKey),
    ).toBeUndefined();
    expect((await queryClient.fetchQuery(yearQuery("2024")))[0].title).toBe(
      "测试直播",
    );
  });
  it("cancels requests when their query is cancelled", async () => {
    let requestSignal;
    spyOn(globalThis, "fetch").mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          requestSignal = signal;
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const request = queryClient.fetchQuery(yearQuery("2024"));
    const outcome = request.catch((error) => error);
    await queryClient.cancelQueries({ queryKey: yearQuery("2024").queryKey });
    expect(await outcome).toBeInstanceOf(Error);
    expect(requestSignal.aborted).toBe(true);
    expect(
      queryClient.getQueryData(yearQuery("2024").queryKey),
    ).toBeUndefined();
  });
  it("rejects invalid JSON", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("invalid"));
    await expect(queryClient.fetchQuery(yearQuery("2024"))).rejects.toThrow();
  });
});

describe("archive manifest loading", () => {
  it("retains the description of an unconfirmed postponed date", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
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
    );
    const manifest = await loadManifest(new AbortController().signal);
    expect(manifest.changes[0].description).toContain("日期待定");
  });

  it("rejects an empty year index", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          years: [],
          works: [],
          livestreams: [],
          changes: [],
        }),
      ),
    );
    await expect(loadManifest(new AbortController().signal)).rejects.toThrow();
  });

  it("exposes an HTTP error without retrying", async () => {
    const fetchData = mock().mockResolvedValue(
      new Response("", { status: 503 }),
    );
    spyOn(globalThis, "fetch").mockImplementation(fetchData);
    await expect(loadManifest(new AbortController().signal)).rejects.toThrow(
      "503",
    );
    expect(fetchData).toHaveBeenCalledOnce();
  });
});
