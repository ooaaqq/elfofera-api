import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./client.js";

const { database, pool } = createDatabase();
try {
  await migrate(database, { migrationsFolder: "./migrations" });
} finally {
  await pool.end();
}
