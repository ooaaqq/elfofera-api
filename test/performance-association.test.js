import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../data/calendar/confirmed/", import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, root), "utf8"));
const events = readdirSync(root)
  .filter((name) => /^events-\d{4}-\d{2}\.json$/.test(name))
  .flatMap((name) => read(name).events);
const performances = readdirSync(root)
  .filter((name) => /^performances-\d{4}-\d{2}\.json$/.test(name))
  .flatMap((name) => read(name).performances);
const eventById = new Map(events.map((event) => [event.id, event]));
const withVideo = (bvid) =>
  performances.filter((p) => p.assets.some((asset) => asset.bvid === bvid));

describe("Performance associations", () => {
  it("keeps every adopted association pointing to an existing event", () => {
    expect(new Set(performances.map((p) => p.id)).size).toBe(
      performances.length,
    );
    for (const p of performances) {
      if (p.eventId) expect(eventById.has(p.eventId)).toBe(true);
    }
  });

  it("associates a stage excerpt with its activity instead of a same-day livestream", () => {
    const performance = withVideo("BV1PYfpYdEwQ")[0];
    expect(eventById.get(performance.eventId)).toMatchObject({
      date: "2025-01-24",
      kind: "activity",
      title: "冰火歌会2025新春季",
    });
  });

  it("uses the independently dated recording when a clip description names a future day", () => {
    const performance = withVideo("BV1JeraYNEjs")[0];
    expect(performance.date).toBe("2025-01-08");
    expect(eventById.get(performance.eventId)).toMatchObject({
      date: "2025-01-08",
      title: "串子大检验",
    });
    expect(performance.assets.map((a) => a.bvid)).toContain("BV18LraY7Ehi");
  });

  it("preserves two renditions explicitly separated in the same collection", () => {
    const renditions = withVideo("BV1Pw4m1d7vC").filter(
      (p) => p.workId === "song_479b976a-6cda-44f3-89a6-6cdb135c7248",
    );
    expect(renditions).toHaveLength(2);
    expect(
      renditions.map(
        (p) => p.assets.find((a) => a.bvid === "BV1Pw4m1d7vC").partNumbers,
      ),
    ).toEqual([[2], [9]]);
  });

  it("treats birthday shows with attested livestream recordings as livestream events", () => {
    for (const id of [
      "evt_014c4fcc-a237-486e-b1de-9d0706837be0",
      "evt_2dc5c67a-0d45-4ec5-9eea-6c5093f6e34c",
    ]) {
      expect(eventById.get(id)).toMatchObject({
        kind: "livestream",
        contentType: "celebration",
        dimension: "3d",
      });
      expect(performances.some((p) => p.eventId === id)).toBe(true);
    }
  });

  it("uses confirmed dates while preserving the contradictory source descriptions", () => {
    const programme = withVideo("BV1sH4y1e7r7")[0];
    expect(eventById.get(programme.eventId)).toMatchObject({
      date: "2024-02-02",
      kind: "activity",
    });
    expect(programme.creditedMembers).toEqual(["minuo", "youen"]);
    expect(programme.creditedPerformers).toEqual(["露米Lumi_Official"]);
    expect(eventById.get(programme.eventId).guests[0].accountId).toBe(
      2000609327,
    );
    const song = withVideo("BV1eirsBFEdG")[0];
    expect(song.date).toBe("2026-01-14");
    expect(eventById.get(song.eventId)).toMatchObject({
      date: "2026-01-14",
      title: "妈妈爱听的歌",
    });
    expect(
      song.evidence.some((source) => source.excerpt?.includes("25.01.14")),
    ).toBe(true);
  });

  it("preserves an unspecified format for a joint weekly plan without inventing a livestream", () => {
    const day = read("plans.json").days.find(
      (day) => day.date === "2026-10-15",
    );
    expect(day.events).toHaveLength(1);
    expect(day.events[0]).toMatchObject({
      members: ["luzao", "youen"],
      plannedTime: "19:00",
      formatLabel: null,
      participation: "collaboration",
      hostMember: "luzao",
    });
    expect(
      events.some(
        (event) => event.date === "2026-10-15" && event.kind === "livestream",
      ),
    ).toBe(false);
  });
});
