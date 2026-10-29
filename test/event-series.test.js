import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const readEvents = (month) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../data/calendar/confirmed/events-${month}.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ).events;

describe("Event series", () => {
  it("keeps EOE joint appearances distinct from similarly named guest game episodes", () => {
    for (const [month, date] of [
      ["2026-01", "2026-01-27"],
      ["2026-05", "2026-05-07"],
      ["2026-06", "2026-06-11"],
    ]) {
      const event = readEvents(month).find(
        (e) => e.date === date && /御姐玩萌妹|萌妹玩御姐/.test(e.title),
      );
      expect(event.recordingNamedMembers).toEqual(
        expect.arrayContaining(["youen", "luzao"]),
      );
      expect(event.series).toBe("御姐玩萌妹");
    }
    const game = readEvents("2026-10").find(
      (e) => e.title === "萌妹玩御姐！！46",
    );
    expect(game.recordingNamedMembers).toEqual(["luzao"]);
    expect(game.series).toBe("萌妹玩游戏");
    expect(game.contentType).toBe("game");
    expect(game.dimension).toBe("2d");
    expect(game.guests.map((guest) => guest.accountId)).toEqual([
      1203217682, 1878154667,
    ]);
  });
  it("groups renamed episodes without changing their titles or content types", () => {
    const events = [...readEvents("2026-06"), ...readEvents("2026-10")];
    const talk = events.find((e) => e.title === "萌妹爱聊天38");
    const walk = events.find((e) => e.title === "萌妹徒步中47");
    expect(talk).toMatchObject({ series: "萌妹玩游戏", contentType: "talk" });
    expect(walk).toMatchObject({ series: "萌妹玩游戏", title: "萌妹徒步中47" });
  });

  it("retains distinct dates when the source repeats an episode number", () => {
    const events = readEvents("2026-01").filter((e) =>
      e.title.startsWith("萌妹玩游戏18"),
    );
    expect(events.map((e) => e.date)).toEqual(["2026-01-18", "2026-01-24"]);
    expect(events.every((e) => e.series === "萌妹玩游戏")).toBe(true);
  });

  it("keeps a numbered chat episode distinct from the standalone chat series", () => {
    const standalone = readEvents("2026-01").find(
      (e) => e.title === "萌妹爱聊天",
    );
    const numbered = readEvents("2026-06").find(
      (e) => e.title === "萌妹爱聊天38",
    );
    expect(standalone.series).toBe("萌妹爱聊天");
    expect(numbered.series).toBe("萌妹玩游戏");
  });

  it("recognizes punctuation in a programme name without grouping a generic game title", () => {
    const newThree = readEvents("2026-09").find(
      (e) => e.title === "继续，看新，三国，吐槽",
    );
    expect(newThree.series).toBe("看新三国");
    const goose = readEvents("2025-12").find(
      (e) => e.title === "和朋友们的鹅鸭杀初体验！!",
    );
    expect(goose.series).toBeUndefined();
    const investigation = readEvents("2026-01").filter(
      (e) => e.date === "2026-01-29" && e.title.includes("大侦探"),
    );
    expect(investigation).toHaveLength(2);
    expect(investigation.every((e) => e.series === "UP大侦探")).toBe(true);
  });
});
