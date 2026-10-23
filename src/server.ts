import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { indexDataset } from "./data.js";
import { createApp } from "./index.js";

const archive = indexDataset(
  JSON.parse(readFileSync(new URL("./archive.json", import.meta.url), "utf8")),
);
const app = createApp(archive);
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
  server.close((error) => {
    if (error) process.exitCode = 1;
    clearTimeout(deadline);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
