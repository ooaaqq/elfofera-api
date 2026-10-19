import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { beforeAll, expect, it } from "vitest";

beforeAll(() => {
  execFileSync(process.execPath, ["frontend/build-data.mjs"]);
});

it("shows confirmed cancellations only as schedule changes, retaining members and time", () => {
  const directory = "data/calendar/confirmed";
  const cancelled = fs
    .readdirSync(directory)
    .filter((file) => /^events-/.test(file))
    .flatMap(
      (file) =>
        JSON.parse(fs.readFileSync(`${directory}/${file}`, "utf8")).events,
    )
    .filter(
      (event) =>
        event.kind === "livestream" && event.occurrence === "cancelled",
    );
  const manifest = JSON.parse(
    fs.readFileSync("frontend/public/data/manifest.json", "utf8"),
  );
  expect(cancelled.length).toBeGreaterThan(0);
  for (const event of cancelled) {
    const year = JSON.parse(
      fs.readFileSync(
        `frontend/public/data/years/${event.date.slice(0, 4)}.json`,
        "utf8",
      ),
    );
    expect(year.some((item) => item.id === event.id)).toBe(false);
    const changes = manifest.changes.filter(
      (change) =>
        change.date === event.date &&
        ["cancel", "cancellation"].includes(change.action),
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].members).toEqual(event.plannedMembers ?? []);
    if (event.plannedTime)
      expect(changes[0].description).toContain(event.plannedTime);
  }
});

it("keeps every work history complete and linked to actual confirmed events", () => {
  const directory = "data/calendar/confirmed";
  const events = fs
    .readdirSync(directory)
    .filter((file) => /^events-/.test(file))
    .flatMap(
      (file) =>
        JSON.parse(fs.readFileSync(`${directory}/${file}`, "utf8")).events,
    );
  const byId = new Map(events.map((event) => [event.id, event]));
  const manifest = JSON.parse(
    fs.readFileSync("frontend/public/data/manifest.json", "utf8"),
  );
  const performances = fs
    .readdirSync(directory)
    .filter((file) => /^performances-/.test(file))
    .flatMap(
      (file) =>
        JSON.parse(fs.readFileSync(`${directory}/${file}`, "utf8"))
          .performances,
    );
  const ids = new Set();
  for (const work of manifest.works) {
    const { performances: history } = JSON.parse(
      fs.readFileSync(
        `frontend/public/data/works/${encodeURIComponent(work.id)}.json`,
        "utf8",
      ),
    );
    expect(history.length).toBe(work.performanceCount);
    for (const item of history) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      expect(["cancelled", "scheduled", "announced"]).not.toContain(
        byId.get(item.eventId).occurrence,
      );
      expect(item.date).toBe(byId.get(item.eventId).date);
      expect(
        item.videoParts.every((part) => Number.isInteger(part) && part > 0),
      ).toBe(true);
    }
  }
  expect(ids.size).toBe(performances.length);
  expect(
    manifest.changes.every(
      (change) => !/(undefined|NaN)/.test(change.description),
    ),
  ).toBe(true);
  expect(new Set(manifest.changes.map((change) => change.id)).size).toBe(
    manifest.changes.length,
  );
});

it("retains the explicit collection parts for both recordings and performance excerpts", () => {
  const year = JSON.parse(
    fs.readFileSync("frontend/public/data/years/2022.json", "utf8"),
  );
  const early = year.find(
    (event) => event.id === "evt_1bbc7a88-deb9-4516-b661-e9718bf8b623",
  );
  expect(early.bvid).toBe("BV12W4y1q7JL");
  expect(early.videoParts).toEqual([1, 3]);
  const later = year.find(
    (event) => event.id === "evt_dc0d1b76-7f07-4158-b211-d989b08005ac",
  );
  expect(later.bvid).not.toBe(early.bvid);
  expect(later.videoParts).toEqual([]);
  const track = year
    .flatMap((event) => event.tracks)
    .find((track) => track.id === "perf_22d8ddb9-2807-4f08-a84e-fdbcd302d20d");
  expect(track.bvid).toBe("BV1Td4y1B7Bx");
  expect(track.videoParts).toEqual([5]);
});

it("indexes every actual livestream across all years without cancelled plans or duplicate IDs", () => {
  const manifest = JSON.parse(
    fs.readFileSync("frontend/public/data/manifest.json", "utf8"),
  );
  const actual = fs
    .readdirSync("frontend/public/data/years")
    .flatMap((file) =>
      JSON.parse(fs.readFileSync(`frontend/public/data/years/${file}`, "utf8")),
    );
  expect(manifest.livestreams.length).toBe(actual.length);
  expect(new Set(manifest.livestreams.map((event) => event.id)).size).toBe(
    actual.length,
  );
  expect(
    manifest.livestreams.toSorted((a, b) => a.id.localeCompare(b.id)),
  ).toEqual(
    actual
      .map(({ id, date, title, members }) => ({ id, date, title, members }))
      .toSorted((a, b) => a.id.localeCompare(b.id)),
  );
});

it("publishes explicitly linked uploads separately without inventing performances or credited members", () => {
  const directory = "data/calendar/confirmed";
  const publications = fs
    .readdirSync(directory)
    .filter((file) => /^events-/.test(file))
    .flatMap(
      (file) =>
        JSON.parse(fs.readFileSync(`${directory}/${file}`, "utf8")).events,
    )
    .filter(
      (event) =>
        event.kind === "publication" && event.occurrence === "published",
    );
  const manifest = JSON.parse(
    fs.readFileSync("frontend/public/data/manifest.json", "utf8"),
  );
  for (const work of manifest.works) {
    const expected = publications
      .filter((event) => event.relatedWorks?.includes(work.id))
      .toSorted(
        (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
      );
    const details = JSON.parse(
      fs.readFileSync(
        `frontend/public/data/works/${encodeURIComponent(work.id)}.json`,
        "utf8",
      ),
    );
    expect(details.publications.map((post) => post.id)).toEqual(
      expected.map((event) => event.id),
    );
    expect(details.publications.length).toBe(work.publicationCount);
    expect(details.performances.length).toBe(work.performanceCount);
    expect(new Set(details.publications.map((post) => post.id)).size).toBe(
      details.publications.length,
    );
    for (const [index, post] of details.publications.entries()) {
      expect(post.date).toBe(expected[index].date);
      expect(post.title).toBe(expected[index].title);
      expect(post.members).toEqual(expected[index].creditedMembers ?? []);
      expect(post.bvid).toBe(expected[index].assets[0].bvid);
    }
  }
  const work = manifest.works.find(
    (work) => work.id === "song_2dd467f6-50ef-4857-a982-69c8903cded2",
  );
  expect(work.performanceCount).toBe(0);
  expect(work.publicationCount).toBe(1);
  const details = JSON.parse(
    fs.readFileSync(`frontend/public/data/works/${work.id}.json`, "utf8"),
  );
  expect(details.performances).toEqual([]);
  expect(details.publications).toEqual([
    {
      id: "evt_73e2d44b-c827-4ee9-9806-13b8e7d783c4",
      date: "2023-06-11",
      title: "属于我们梦幻般的《Beautiful World》【米诺x真栗】",
      members: [],
      bvid: "BV14M4y1Y7bN",
      videoParts: [],
    },
  ]);
});
