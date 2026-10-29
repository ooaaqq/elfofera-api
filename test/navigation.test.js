import { describe, expect, it } from "bun:test";
import {
  defaultLocation,
  formatLocation,
  parseLocation,
} from "../frontend/navigation.js";

describe("archive URL state", () => {
  it("uses archive defaults for the initial location", () => {
    expect(parseLocation("").data).toEqual(defaultLocation);
  });

  it("round-trips Chinese queries, pagination and the selected work", () => {
    const state = {
      ...defaultLocation,
      view: "songs",
      songQuery: "宝贝 & 张悬?",
      workId: "song-baby",
      page: 3,
      pageSize: 50,
      historyYear: "2023",
      historyMember: "luzao",
      order: "oldest",
      historyPage: 2,
    };
    expect(parseLocation(formatLocation(state)).data).toEqual(state);
  });

  it("round-trips documentation sections without losing archive filters", () => {
    const state = {
      ...defaultLocation,
      view: "api",
      section: "api-history",
      year: "2022",
      month: 7,
      member: "luzao",
      songQuery: "Lemon",
    };
    expect(parseLocation(formatLocation(state)).data).toEqual(state);
    expect(parseLocation("#thanks?section=thanks-community").data.section).toBe(
      "thanks-community",
    );
  });

  it.each(["songs", "api", "thanks"])(
    "preserves archive and song positions when opening %s",
    (view) => {
      const state = {
        ...defaultLocation,
        year: "2022",
        month: 12,
        date: "2022-12-03",
        eventId: "event-1",
        member: "luzao",
        query: "歌",
        archivePage: 4,
        songQuery: "宝贝",
        workId: "baby",
        page: 2,
      };
      expect(parseLocation(formatLocation({ ...state, view })).data).toEqual({
        ...state,
        view,
      });
    },
  );

  it.each([
    "#other",
    "#api?section=unknown",
    "#archive?month=13",
    "#archive?archivePage=0",
    "#archive?member=invalid",
    "#archive?date=2026-02-30",
    "#songs?page=0",
    "#songs?pageSize=100",
    "#songs?order=invalid",
  ])("rejects invalid URL state %s", (hash) => {
    expect(parseLocation(hash).success).toBe(false);
  });
});
