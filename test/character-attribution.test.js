import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../data/calendar/confirmed/${name}`, import.meta.url),
      "utf8",
    ),
  );
const performances = [
  ...read("performances-2025-02.json").performances,
  ...read("performances-2025-08.json").performances,
];

describe("Luzao character attribution", () => {
  it("credits Luzao for performances billed as Luyi", () => {
    const bvids = [
      "BV1rSwSe6ESs",
      "BV1A2wSekE2K",
      "BV1CgA5eVEpB",
      "BV1r3A5ekEng",
      "BV1zjA5euEpP",
      "BV1uZAVepE8N",
      "BV1yTA5eLECa",
      "BV1mfAVeDEnA",
      "BV1yMA5eyEJz",
      "BV1WTAWeTEQc",
      "BV1yaeHz6EUD",
    ];
    for (const bvid of bvids) {
      const matches = performances.filter((p) =>
        p.assets.some((a) => a.bvid === bvid),
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].creditedMembers).toContain("luzao");
      expect(matches[0].creditedPerformers ?? []).not.toContain("路翼");
    }
  });

  it("keeps alternate clips in one performance with its original event", () => {
    const pairs = [
      ["BV1A2wSekE2K", "BV1UZAVeHEJe"],
      ["BV1yTA5eLECa", "BV1vNALeiEQk"],
      ["BV1mfAVeDEnA", "BV1VgALeAEBF"],
      ["BV1yMA5eyEJz", "BV1LTALeKEBv"],
      ["BV1WTAWeTEQc", "BV1tZApeVEFV"],
    ];
    for (const [primary, alternate] of pairs) {
      const matches = performances.filter((p) =>
        p.assets.some((a) => a.bvid === primary || a.bvid === alternate),
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].eventId).toBeTruthy();
      expect(matches[0].assets.map((a) => a.bvid)).toEqual(
        expect.arrayContaining([primary, alternate]),
      );
    }
  });

  it("credits Luzao for the publication naming Karmen and Luyi", () => {
    const event = read("events-2026-08.json").events.find((e) =>
      e.assets?.some((a) => a.bvid === "BV1pH8t6oEVu"),
    );
    expect(event.creditedMembers).toEqual(["luzao"]);
    expect(event.text).toContain("Karmen,路翼");
  });
});
