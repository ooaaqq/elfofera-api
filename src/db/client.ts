import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readDatabaseConfig } from "./config.js";

export function createDatabase() {
  const pool = new Pool({
    ...readDatabaseConfig(),
    max: 5,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
  });
  pool.on("error", () => {
    console.error("Idle database connection failed");
  });
  return { database: drizzle(pool), pool };
}

export type Database = ReturnType<typeof createDatabase>["database"];
