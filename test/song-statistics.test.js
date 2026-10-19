import { expect, it } from "vitest";
import { mostPerformedArtists } from "../frontend/song-statistics.js";

it("counts performances of works under their credited original artists, deduplicating each work's credits", () => {
  const works = [
    { artists: ["甲", "甲", "乙"], performanceCount: 5 },
    { artists: ["甲"], performanceCount: 2 },
    { artists: ["丙"], performanceCount: 6 },
    { artists: ["乙"], performanceCount: 0 },
    { artists: [], performanceCount: 20 },
    { artists: [" "], performanceCount: 100 },
  ];
  const original = structuredClone(works);
  expect(mostPerformedArtists(works)).toEqual([
    { name: "甲", workCount: 2, performanceCount: 7 },
    { name: "丙", workCount: 1, performanceCount: 6 },
    { name: "乙", workCount: 1, performanceCount: 5 },
  ]);
  expect(works).toEqual(original);
});

it("breaks performance-count ties by the number of performed works, excluding publication-only artists", () => {
  expect(
    mostPerformedArtists([
      { artists: ["甲"], performanceCount: 4 },
      { artists: ["乙"], performanceCount: 2 },
      { artists: ["乙"], performanceCount: 2 },
      { artists: ["丙"], performanceCount: 0 },
    ]),
  ).toEqual([
    { name: "乙", workCount: 2, performanceCount: 4 },
    { name: "甲", workCount: 1, performanceCount: 4 },
  ]);
  expect(mostPerformedArtists([])).toEqual([]);
});
