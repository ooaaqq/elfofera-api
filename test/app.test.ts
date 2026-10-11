import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../src/db/client.js";
import { createApp } from "../src/index.js";

let pool: Pool;
let database: Database;

beforeEach(() => {
  pool = new Pool();
  database = drizzle(pool);
});

afterEach(async () => {
  await pool.end();
});

describe("API infrastructure", () => {
  it("returns 200 only after the database query succeeds", async () => {
    const execute = vi.spyOn(database, "execute");
    execute.mockResolvedValue({
      rows: [],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });
    const response = await createApp(database).request("/health");
    expect(execute).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      service: "available",
      database: "available",
    });
  });

  it("returns 503 without exposing database errors or retrying", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const execute = vi.spyOn(database, "execute");
    execute.mockRejectedValue(new Error("private database details"));
    const response = await createApp(database).request("/health");
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(execute).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({
      service: "available",
      database: "unavailable",
    });
  });

  it("exposes separate success and failure contracts without querying the database", async () => {
    const execute = vi.spyOn(database, "execute");
    const response = await createApp(database).request("/openapi.json");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      paths: {
        "/health": {
          get: {
            responses: { "200": expect.any(Object), "503": expect.any(Object) },
          },
        },
      },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 404 for resources that are not implemented", async () => {
    const response = await createApp(database).request("/songs");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
