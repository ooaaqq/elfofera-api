import { serve } from "@hono/node-server";
import { createDatabase } from "./db/client.js";
import { createApp } from "./index.js";

const { database, pool } = createDatabase();
const app = createApp(database);
const server = serve(
  { fetch: app.fetch, hostname: "127.0.0.1", port: 3000 },
  () => console.log("Elfofera API: http://127.0.0.1:3000"),
);

server.on("error", () => {
  console.error("HTTP server failed");
  process.exitCode = 1;
  shutdown();
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => {
    console.error("Shutdown timed out");
    process.exit(1);
  }, 10_000);
  deadline.unref();
  server.close(async (error) => {
    try {
      await pool.end();
      if (error) process.exitCode = 1;
    } catch {
      console.error("Database shutdown failed");
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
