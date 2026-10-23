import { describe, expect, it } from "vitest";
import { eventView, performanceView } from "../src/views.js";

describe("attribution contracts", () => {
  it("keeps group credit without inventing individual performers", () => {
    const performance = performanceView({
      id: "performance",
      date: "2023-08-11",
      eventId: "event",
      workId: "work",
      type: "singing",
      creditedGroup: "EOE",
      assets: [],
    });
    expect(performance.creditedGroup).toBe("EOE");
    expect(performance.creditedMembers).toEqual([]);
  });

  it("keeps the broadcast host separate from the actual cast", () => {
    const event = eventView({
      id: "event",
      date: "2024-02-13",
      title: "夜间来电",
      kind: "livestream",
      occurrence: "recording-attested",
      hostMember: "youen",
    });
    expect(event.hostMember).toBe("youen");
    expect(event.recordingNamedMembers).toEqual([]);
    expect(event.plannedMembers).toEqual([]);
  });
});
