import { describe, expect, it } from "vitest";
import { performanceStatistics } from "../src/contracts.js";

const item = (
  id: string,
  creditedMembers: string[],
  sourceUrls: string[] = [],
) => ({
  id,
  date: "2023-04-08",
  eventId: null,
  workId: "song_test",
  type: "singing",
  creditedMembers,
  sourceUrls,
});
describe("performance record counting", () => {
  it("counts a duet once in total and once for each named member, not per source", () => {
    const stats = performanceStatistics([
      item(
        "one",
        ["luzao", "luzao", "youen"],
        ["https://example.com/1", "https://example.com/2"],
      ),
      item("two", []),
    ]);
    expect(stats.total).toBe(2);
    expect(stats.uncredited).toBe(1);
    expect(stats.byMember.map((entry) => entry.count)).toEqual([1, 1, 0, 0, 0]);
  });
  it("returns five zero counts and limits source examples", () => {
    expect(performanceStatistics([]).byMember).toHaveLength(5);
    const stats = performanceStatistics(
      Array.from({ length: 5 }, (_, i) =>
        item(String(i), ["luzao"], [`https://example.com/${i}`]),
      ),
    );
    expect(stats.byMember[0]?.sourceUrls).toHaveLength(3);
    expect(stats.byMember[0]?.count).toBe(5);
  });
});
