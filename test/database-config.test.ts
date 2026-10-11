import { describe, expect, it, vi } from "vitest";
import { readDatabaseConfig } from "../src/db/config.js";

describe("database configuration", () => {
  it("accepts a Unix socket and peer-authenticated user", () => {
    vi.stubEnv("PGHOST", "/run/postgresql");
    vi.stubEnv("PGDATABASE", "elfofera");
    vi.stubEnv("PGUSER", "elfofera-api");
    vi.stubEnv("PGPORT", undefined);
    expect(readDatabaseConfig()).toEqual({
      host: "/run/postgresql",
      database: "elfofera",
      user: "elfofera-api",
      port: 5432,
    });
  });

  it("rejects missing configuration instead of using implicit driver defaults", () => {
    vi.stubEnv("PGHOST", undefined);
    expect(readDatabaseConfig).toThrow(
      "PGHOST, PGDATABASE and PGUSER are required",
    );
  });

  it("rejects an invalid PostgreSQL port", () => {
    vi.stubEnv("PGHOST", "/run/postgresql");
    vi.stubEnv("PGDATABASE", "elfofera");
    vi.stubEnv("PGUSER", "elfofera-api");
    vi.stubEnv("PGPORT", "65536");
    expect(readDatabaseConfig).toThrow("PGPORT must be a valid port");
  });
});
