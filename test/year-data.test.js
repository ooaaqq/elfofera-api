import { describe, expect, it, vi } from "vitest";
import { createYearLoader } from "../frontend/year-data.js";

const response = (year) =>
  new Response(JSON.stringify([{ id: year, date: `${year}-07-24` }]), {
    headers: { "Content-Type": "application/json" },
  });

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

  it("rejects invalid JSON instead of caching it", async () => {
    const load = createYearLoader(
      vi.fn().mockResolvedValue(new Response("invalid")),
    );
    await expect(load("2024")).rejects.toThrow();
  });
});
