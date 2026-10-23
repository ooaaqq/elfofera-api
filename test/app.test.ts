import { describe, expect, it } from "vitest";
import { indexDataset } from "../src/data.js";
import { createApp } from "../src/index.js";

const archive = indexDataset({
  events: [],
  works: [],
  performances: [],
  recordings: [],
  plans: [],
  changes: [],
});
describe("API boundary", () => {
  it("serves health only after archive construction and exports OpenAPI", async () => {
    const app = createApp(archive);
    expect(await (await app.request("/health")).json()).toEqual({
      service: "available",
    });
    expect((await app.request("/health")).headers.get("Cache-Control")).toBe(
      "no-store",
    );
    const document = await (await app.request("/openapi.json")).json();
    expect(document).toMatchObject({
      paths: { "/v1/timeline": { get: expect.any(Object) } },
    });
  });
  it("returns 404 for resources that are not implemented", async () => {
    const response = await createApp(archive).request("/songs");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("rejects invalid dates, unbounded ranges, members and includes before querying the archive", async () => {
    for (const query of [
      "from=2026-02-30&through=2026-03-01",
      "from=2026-01-01&through=2026-02-01",
      "from=2026-10-11&through=2026-10-10",
      "from=2026-10-11&through=2026-10-11&member=unknown",
      "from=2026-10-11&through=2026-10-11&include=events,wrong",
      "from=2026-10-11&through=2026-10-11&include=events,events",
    ])
      expect(
        (await createApp(archive).request(`/v1/timeline?${query}`)).status,
      ).toBe(400);
  });

  it("rejects punctuation-only searches and excessive page sizes", async () => {
    for (const query of [
      "q=!!!",
      "limit=101",
      "offset=-1",
      "include=history",
    ]) {
      expect(
        (await createApp(archive).request(`/v1/works?${query}`)).status,
      ).toBe(400);
    }
  });
});
