import { defineConfig } from "drizzle-kit";
import config from "./drizzle.config.js";
import { readDatabaseConfig } from "./src/db/config.js";

export default defineConfig({
  ...config,
  dbCredentials: {
    ...readDatabaseConfig(),
    ...(process.env.PGPASSWORD === undefined
      ? {}
      : { password: process.env.PGPASSWORD }),
  },
});
