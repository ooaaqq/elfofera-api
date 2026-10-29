import { describe, expect, it } from "bun:test";
import { searchLivestreams } from "../frontend/archive-search.js";

const events = [
  { id: "early", date: "2022-09-01", title: "歌回 Hello", members: ["luzao"] },
  { id: "late", date: "2026-01-01", title: "新年歌回", members: ["youen"] },
  {
    id: "middle",
    date: "2024-03-01",
    title: "游戏时间",
    members: ["luzao", "youen"],
  },
];

describe("global livestream search", () => {
  it("searches all years and returns newest matches first without changing the index", () => {
    expect(searchLivestreams(events, "歌回", "all").map((e) => e.id)).toEqual([
      "late",
      "early",
    ]);
    expect(events.map((e) => e.id)).toEqual(["early", "late", "middle"]);
  });
  it("applies only the selected member to title matches", () => {
    expect(searchLivestreams(events, "歌回", "luzao").map((e) => e.id)).toEqual(
      ["early"],
    );
    expect(searchLivestreams(events, "游戏", "youen").map((e) => e.id)).toEqual(
      ["middle"],
    );
  });
  it("normalizes surrounding whitespace and casing and keeps empty queries empty", () => {
    expect(
      searchLivestreams(events, "  HELLO  ", "all").map((e) => e.id),
    ).toEqual(["early"]);
    expect(searchLivestreams(events, " ", "all")).toEqual([]);
    expect(searchLivestreams(events, "不存在", "all")).toEqual([]);
  });
});
