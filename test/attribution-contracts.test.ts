import { describe, expect, it } from "vitest";
import { eventView, performanceView } from "../src/contracts.js";

describe("attribution contracts", () => {
  it("keeps group credit without inventing individual performers", () => {
    const performance = performanceView({
      id: "performance",
      date: "2023-08-11",
      eventId: "event",
      workId: "work",
      type: "singing",
      data: { creditedGroup: "EOE" },
    });
    expect(performance.creditedGroup).toBe("EOE");
    expect(performance.creditedMembers).toEqual([]);
  });

  it("keeps the broadcast host separate from the actual cast", () => {
    const event = eventView({
      id: "event",
      date: "2024-02-13",
      endDate: null,
      title: "夜间来电",
      kind: "livestream",
      occurrence: "recording-attested",
      data: { hostMember: "youen" },
    });
    expect(event.hostMember).toBe("youen");
    expect(event.recordingNamedMembers).toEqual([]);
    expect(event.plannedMembers).toEqual([]);
  });
});
