import { expect, it } from "vitest";
import { videoParts, videoUrl } from "../frontend/video.js";

it("opens the exact collection part and rejects invalid part references", () => {
  expect(videoUrl("BV12W4y1q7JL", 3)).toBe(
    "https://www.bilibili.com/video/BV12W4y1q7JL?p=3",
  );
  expect(videoUrl("BV12W4y1q7JL")).toBe(
    "https://www.bilibili.com/video/BV12W4y1q7JL",
  );
  expect(videoParts({ bvid: "video", partNumber: 2 })).toEqual([2]);
  expect(() => videoParts({ bvid: "video", partNumbers: [0] })).toThrow(
    "Invalid video part",
  );
  expect(() => videoParts({ bvid: "video", partNumber: 0 })).toThrow(
    "Invalid video part",
  );
});
