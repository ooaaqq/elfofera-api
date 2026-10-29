import { describe, expect, it } from "bun:test";
import { buildScheduleChanges } from "../frontend/schedule-changes.js";

const build = (change, events = []) => buildScheduleChanges([change], events);

describe("schedule presentation", () => {
  it("renders a time adjustment from explicit before and after slots", () => {
    const [change] = build({
      action: "time-change",
      members: ["youen"],
      from: { date: "2026-10-27", plannedTime: "19:30" },
      to: { date: "2026-10-27", plannedTime: "18:30" },
    });
    expect(change.date).toBe("2026-10-27");
    expect(change.description).toBe("柚恩 · 时间调整：19:30 → 18:30");
  });
  it("retains both dates and times for a reschedule using explicit date fields", () => {
    const changes = build({
      action: "reschedule",
      member: "yumo",
      fromDate: "2024-10-18",
      toDate: "2024-10-17",
      fromPlannedTime: "19:00",
      toPlannedTime: "19:30",
    });
    expect(changes.map((c) => c.date)).toEqual(["2024-10-18", "2024-10-17"]);
    expect(changes[0].description).toBe(
      "虞莫 · 改期：2024-10-18 19:00 → 2024-10-17 19:30",
    );
    expect(changes[0].members).toEqual(["yumo"]);
  });
  it("shows a bounded absence on each affected date, without cancelling actual streams", () => {
    const changes = build({
      action: "member-absence",
      member: "waner",
      fromDate: "2024-03-30",
      throughDate: "2024-04-01",
    });
    expect(changes.map((c) => c.date)).toEqual([
      "2024-03-30",
      "2024-03-31",
      "2024-04-01",
    ]);
    expect(changes[0].description).toContain(
      "缺席（2024-03-30 至 2024-04-01）",
    );
    expect(changes[0].description).not.toContain("取消");
  });
  it("keeps postponements undated and uses only the linked announcement date", () => {
    const changes = build(
      {
        action: "postpone",
        members: ["waner", "yumo"],
        eventTitle: "双人才艺回",
        originalDateLabel: "2023年6月初",
        relatedAnnouncementEventId: "notice",
      },
      [{ id: "notice", date: "2023-05-25" }],
    );
    expect(changes.map((c) => c.date)).toEqual(["2023-05-25"]);
    expect(changes[0].description).toContain("原定2023年6月初");
    expect(changes[0].description).toContain("新时间未公布");
  });
  it("does not apply a targeted cancellation to everyone in the original schedule", () => {
    const changes = build({
      action: "cancellation",
      date: "2026-09-09",
      members: ["youen"],
      originalPlan: {
        events: [
          { members: ["youen"], plannedTime: "19:00" },
          { members: ["luzao"], plannedTime: "20:50" },
        ],
      },
    });
    expect(changes[0].members).toEqual(["youen"]);
    expect(changes[0].description).toBe("柚恩 19:00 · 取消");
  });
  it("retains both original and replacement members for lineup filtering", () => {
    const changes = build({
      action: "lineup-change",
      date: "2022-11-01",
      originalMembers: ["yumo"],
      members: ["youen"],
      plannedTime: "20:00",
    });
    expect(changes[0].members).toEqual(["youen", "yumo"]);
    expect(changes[0].description).toContain("虞莫 → 柚恩");
  });
  it("renders known format labels and an unspecified original format explicitly", () => {
    expect(
      build({
        action: "format-change",
        date: "2024-05-22",
        member: "minuo",
        fromFormatLabel: "3D",
        toFormatLabel: "2D",
      })[0].description,
    ).toContain("3D → 2D");
    expect(
      build({
        action: "format-change",
        date: "2024-06-28",
        member: "youen",
        fromFormatLabel: null,
        toFormatLabel: "2D",
      })[0].description,
    ).toContain("原形态未标注 → 2D");
  });
  it("preserves an unknown reschedule date and approximate delay instead of guessing", () => {
    expect(
      build({
        action: "reschedule",
        from: { date: "2022-12-02" },
        to: { date: null, dateDescription: "下周" },
      })[0].description,
    ).toContain("下周");
    expect(
      build({
        action: "postponement",
        date: "2026-10-11",
        members: ["luzao"],
        from: { date: "2026-10-11", plannedTime: "19:00" },
        to: { date: "2026-10-11", delayMinutes: 10 },
      })[0].description,
    ).toContain("约延后 10 分钟");
  });
  it("preserves tentative absence and does not invent an end date", () => {
    const c = build({
      action: "tentative-absence",
      member: "waner",
      fromDate: "2023-05-25",
      throughDate: "2023-05-28",
    });
    expect(c[0].description).toContain("暂定缺席");
    const open = build({
      action: "member-absence",
      member: "yumo",
      fromDate: "2022-12-11",
      until: "身体恢复",
    });
    expect(open).toHaveLength(1);
    expect(open[0].description).toContain("至身体恢复");
  });
  it("rejects missing dates, invalid ranges and unhandled actions", () => {
    expect(() => build({ action: "postpone" })).toThrow("Missing date");
    expect(() =>
      build({
        action: "member-absence",
        fromDate: "2024-04-02",
        throughDate: "2024-04-01",
      }),
    ).toThrow("Invalid schedule range");
    expect(() => build({ action: "new-action", date: "2024-01-01" })).toThrow(
      "Unsupported schedule action",
    );
  });
});
