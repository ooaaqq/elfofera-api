/** Build the single validated data snapshot and the AstrBot contract. */
import { mkdirSync, writeFileSync } from "node:fs";
import { indexDataset, readConfirmed } from "./data.js";
import { toolCatalog } from "./tools.js";

const archive = indexDataset(readConfirmed("data/calendar/confirmed"));
writeFileSync("dist/archive.json", JSON.stringify(archive.data));
mkdirSync("generated", { recursive: true });
writeFileSync(
  "generated/tools.json",
  `${JSON.stringify(toolCatalog(), null, 2)}\n`,
);
console.log(
  `Validated ${archive.events.size} events, ${archive.works.size} works, ${archive.data.performances.length} performances`,
);
