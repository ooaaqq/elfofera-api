import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { indexDataset, readConfirmed } from "../src/data.js";
import { toolCatalog } from "../src/tools.js";

const source = readConfirmed("data/calendar/confirmed");
it("rejects duplicate identities and broken references at the source boundary", () => {
  const duplicate = structuredClone(source);
  const first = duplicate.events[0];
  if (!first) throw new Error("Missing event fixture");
  duplicate.events.push(first);
  expect(() => indexDataset(duplicate)).toThrow("Duplicate event");
  const broken = structuredClone(source);
  const performance = broken.performances[0];
  if (!performance) throw new Error("Missing performance fixture");
  performance.workId = "missing";
  expect(() => indexDataset(broken)).toThrow("Unlinked performance");
});
it("uses all confirmed works including works without performances", () => {
  const archive = indexDataset(source);
  expect(archive.works.size).toBe(source.works.length);
  expect(
    source.works.some((work) => !archive.performancesByWork.has(work.id)),
  ).toBe(true);
});
it("keeps recording collections linked to every attested event", () => {
  const archive = indexDataset(source);
  expect(archive.eventByRecording.get("BV12W4y1q7JL")?.length).toBeGreaterThan(
    1,
  );
});
it("exports the exact generated tool catalog and explicit nullable optional inputs", () => {
  const catalog = toolCatalog();
  expect(JSON.parse(readFileSync("generated/tools.json", "utf8"))).toEqual(
    catalog,
  );
  expect(catalog).toHaveLength(4);
  const search = catalog.find((item) => item.name === "elfofera_search_works");
  if (!search) throw new Error("Missing search contract");
  expect(search.parameters.required).toContain("artist");
  expect(search.parameters.properties.artist).toMatchObject({
    anyOf: expect.arrayContaining([{ type: "null" }]),
  });
});
