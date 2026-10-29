import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

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
  it("keeps the latest joint stream and contradictory clip dates tied to recording evidence", () => {
    const joint = events.filter(
      (event) => event.date === "2026-10-29" && event.kind === "livestream",
    );
    expect(joint).toHaveLength(1);
    expect(joint[0].recordingNamedMembers.toSorted()).toEqual([
      "luzao",
      "youen",
    ]);
    expect(joint[0].preferredRecordingBvid).toBe("BV1opsf6ZEJx");
    for (const bvid of ["BV1ETsX61E6u", "BV1ETsX61EyX"]) {
      const matches = withVideo(bvid);
      expect(matches).toHaveLength(1);
      expect(matches[0].date).toBe("2026-10-28");
      expect(eventById.get(matches[0].eventId).preferredRecordingBvid).toBe(
        "BV1Ayx764EiN",
      );
    }
    const plan = read("plans.json").days.find(
      (day) => day.date === "2026-11-01",
    );
    expect(plan.events[0]).toMatchObject({
      members: ["youen"],
      plannedTime: "19:30",
      formatLabel: "电台",
    });
  });
  it("preserves continuous format changes as stages of one event", () => {
    const change = events.find(
      (event) =>
        event.date === "2026-05-23" &&
        event.recordingNamedMembers?.includes("luzao"),
    );
    expect(change.stages.map((stage) => stage.dimension)).toEqual(["2d", "1d"]);
    expect(change.stages.flatMap((stage) => stage.recordingBvids)).toEqual([
      "BV1PhGB6SErc",
      "BV1oUGB6TEM5",
      "BV1AqG66WE1P",
    ]);
    const restart = events.filter(
      (event) =>
        event.date === "2025-06-06" &&
        event.recordingNamedMembers?.includes("luzao"),
    );
    expect(restart).toHaveLength(1);
    expect(restart[0].stages.map((stage) => stage.title)).toEqual([
      "抢救中，",
      "一起唱歌!",
    ]);
    expect(restart[0].recordings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bvid: restart[0].preferredRecordingBvid }),
      ]),
    );
  });

  it("keeps separated sessions distinct even when their titles are similar", () => {
    for (const [date, member, hours] of [
      ["2024-07-08", "waner", [0, 18]],
      ["2025-04-15", "luzao", [20, 23]],
    ]) {
      const sessions = events.filter(
        (event) =>
          event.date === date && event.recordingNamedMembers?.includes(member),
      );
      expect(sessions).toHaveLength(2);
      expect(sessions.flatMap((event) => event.titleHours)).toEqual(hours);
    }
  });
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

  it("keeps same-title compositions separate while correcting a misassigned clip", () => {
    const performance = withVideo("BV1k1421R7GJ")[0];
    const work = read("songs.json").works.find(
      (item) => item.id === performance.workId,
    );
    expect(work.originalArtists).toEqual(["张韶涵"]);
    expect(performance.assets.map((asset) => asset.bvid)).toContain(
      "BV1eZ421n7Ji",
    );
    expect(
      read("songs.json").works.some(
        (item) =>
          item.title === "最近好吗" && item.originalArtists.includes("金莎"),
      ),
    ).toBe(true);
  });

  it("counts the attested March 15 restart as one broadcast", () => {
    const sessions = events.filter(
      (event) => event.date === "2024-03-15" && event.kind === "livestream",
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0].recordings.map((recording) => recording.bvid)).toEqual(
      expect.arrayContaining(["BV122421A7QX", "BV14K421v7oA"]),
    );
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

  it("preserves the joint plan separately from the subsequently confirmed 3D recording", () => {
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
    const actual = events.filter(
      (event) => event.date === "2026-10-15" && event.kind === "livestream",
    );
    expect(actual).toHaveLength(1);
    expect(actual[0]).toMatchObject({
      occurrence: "recording-attested",
      dimension: "3d",
      plannedTime: "19:00",
      titleHours: [18],
      recordingNamedMembers: ["luzao", "youen"],
      preferredRecordingBvid: "BV1LPJm6yEgW",
    });
  });

  it("uses the latest schedule image and requires separate evidence for actual broadcasts", () => {
    const days = read("plans.json").days.filter(
      (day) => day.date >= "2026-10-19" && day.date <= "2026-10-25",
    );
    expect(days).toHaveLength(7);
    expect(days[0].source.imageUrl).toContain(
      "c9ba992201c80f1dc01d660cd01f41662018113152.jpg",
    );
    expect(days[1].events[0]).toMatchObject({
      members: ["youen"],
      plannedTime: "20:00",
      formatLabel: "2D",
    });
    expect(days[3].events[0]).toMatchObject({
      members: ["youen"],
      plannedTime: "19:00",
      formatLabel: "3D",
    });
    expect(days[4]).toMatchObject({ restDay: true, events: [] });
    for (const event of events.filter(
      (event) =>
        event.date >= "2026-10-19" &&
        event.date <= "2026-10-25" &&
        event.kind === "livestream",
    )) {
      expect(event.occurrence).toBe("recording-attested");
      expect(event.preferredRecordingBvid).toBeTruthy();
      expect(event.evidence.recordings.length).toBeGreaterThan(0);
    }
  });

  it("uses the revised weekly image while retaining the original weekend plans", () => {
    const days = read("plans.json").days;
    expect(
      days.find((day) => day.date === "2026-10-17").events[0].members,
    ).toEqual(["youen"]);
    expect(
      days.find((day) => day.date === "2026-10-18").events[0].members,
    ).toEqual(["luzao"]);
    const changes = read("schedule-changes-2026-10.json").changes.filter(
      (change) => change.action === "rescheduling",
    );
    expect(changes).toHaveLength(2);
    for (const change of changes) {
      expect(change.originalPlan.date).toBe(change.from.date);
      expect(change.originalPlan.events[0].members).toEqual(change.members);
      expect(change.to.date).not.toBe(change.from.date);
      expect(eventById.get(change.eventId).kind).toBe("announcement");
    }
  });

  it("attributes Luyi and Karmen clips to Luzao and keeps an independent cover on its publication", () => {
    for (const bvid of [
      "BV1f6AAzYEs1",
      "BV1kYAAzMEwH",
      "BV1hdAAzpEE3",
      "BV1dzpn61Efe",
      "BV1Rkpn6CEtA",
      "BV162p765EB9",
    ]) {
      const matches = withVideo(bvid);
      expect(matches).toHaveLength(1);
      expect(matches[0].creditedMembers).toEqual(["luzao"]);
      expect(eventById.get(matches[0].eventId).kind).toBe("livestream");
    }
    const cover = withVideo("BV1Lnph6zEVr")[0];
    expect(eventById.get(cover.eventId).kind).toBe("publication");
  });

  it("groups interrupted game recordings without counting tiny failed segments as extra events", () => {
    const matches = events.filter(
      (event) => event.date === "2026-03-06" && event.title.includes("三角洲"),
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].recordings).toHaveLength(1);
    expect(matches[0].preferredRecordingBvid).toBe("BV1KRPxzjE2z");
    expect(matches[0].evidence.recordings).toHaveLength(4);
  });
});
