import { afterEach, describe, expect, it } from "bun:test";
import { queryClient, statusQuery } from "../frontend/data.ts";
import { serviceStatus, statusHistory } from "../frontend/status.ts";

const loadStatus = () => queryClient.fetchQuery(statusQuery);

const now = Date.parse("2026-10-31T09:00:00Z");
const endpoint = {
  key: "apps_example",
  name: "Example",
  group: "应用服务",
  results: [
    { timestamp: "2026-10-31T08:59:00Z", duration: 12_000_000, success: false },
    { timestamp: "2026-10-31T09:00:00Z", duration: 8_000_000, success: true },
  ],
};
const originalFetch = globalThis.fetch;
afterEach(() => {
  queryClient.clear();
  globalThis.fetch = originalFetch;
});

describe("service status", () => {
  it("uses the latest probe for current status", () => {
    const service = serviceStatus(endpoint, now);
    expect(service.state).toBe("up");
    expect(service.latest.duration).toBe(8_000_000);
    expect(
      serviceStatus({ ...endpoint, results: endpoint.results.slice(0, 1) }, now)
        .state,
    ).toBe("down");
  });

  it("does not present stale or disconnected observations as healthy", () => {
    expect(serviceStatus(endpoint, now + 180_001).state).toBe("unknown");
    expect(serviceStatus(endpoint, now, true).state).toBe("unknown");
    const empty = serviceStatus({ ...endpoint, results: [] }, now);
    expect(empty.state).toBe("unknown");
  });

  it("accepts the native Gatus response and keeps only display fields", async () => {
    globalThis.fetch = async () =>
      Response.json([{ ...endpoint, url: "http://private.test" }]);
    const services = await loadStatus(new AbortController().signal);
    expect(services).toEqual([endpoint]);
  });

  it("rejects failed requests and malformed observations", async () => {
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await expect(loadStatus(new AbortController().signal)).rejects.toThrow(
      "503",
    );
    globalThis.fetch = async () =>
      Response.json([{ ...endpoint, results: [{ success: "true" }] }]);
    await expect(loadStatus(new AbortController().signal)).rejects.toThrow();
  });
});

describe("status history", () => {
  it("keeps missing periods unknown and separates local midnight and six-hour boundaries", () => {
    const timestamp = (day, hour, minute = 0) =>
      new Date(2026, 9, day, hour, minute).toISOString();
    const now = new Date(2026, 9, 31, 17).getTime();
    const results = [
      { timestamp: timestamp(30, 23, 59), success: true },
      { timestamp: timestamp(31, 0), success: true },
      { timestamp: timestamp(31, 5, 59), success: false },
      { timestamp: timestamp(31, 6), success: true },
      { timestamp: timestamp(31, 18), success: false },
      { timestamp: new Date(2026, 8, 1).toISOString(), success: false },
    ];
    const days = statusHistory(results, now);
    expect(days).toHaveLength(30);
    expect(new Date(days[0].timestamp).getDate()).toBe(2);
    expect(days[0].slots).toEqual(
      Array.from({ length: 4 }, (_, index) => ({
        hour: index * 6,
        passed: 0,
        failed: 0,
      })),
    );
    expect(days[28].slots[3]).toEqual({ hour: 18, passed: 1, failed: 0 });
    expect(days[29].slots).toEqual([
      { hour: 0, passed: 1, failed: 1 },
      { hour: 6, passed: 1, failed: 0 },
      { hour: 12, passed: 0, failed: 0 },
      { hour: 18, passed: 0, failed: 0 },
    ]);
  });

  it("uses calendar dates across month boundaries", () => {
    const days = statusHistory([], new Date(2026, 2, 1, 12).getTime());
    expect(new Date(days[0].timestamp).getMonth()).toBe(0);
    expect(new Date(days[0].timestamp).getDate()).toBe(31);
    expect(new Date(days[29].timestamp).getDate()).toBe(1);
  });
});
