import { describe, expect, it } from "vitest";
import {
  buildBatchClipPayload,
  isSupportedThumbnailFile,
  parseTagInput
} from "./libraryApi";

describe("parseTagInput", () => {
  it("normalizes comma-separated tags and removes duplicates", () => {
    expect(parseTagInput("Ava, calm voice, Ava")).toEqual([
      "ava",
      "calm_voice"
    ]);
  });
});

describe("buildBatchClipPayload", () => {
  it("serializes the clip timing and naming data expected by the backend", () => {
    expect(
      buildBatchClipPayload([
        {
          id: "clip-1",
          title: "Ava calm",
          descriptor: "calm",
          start: 1,
          end: 4.4,
          outputName: "ava_calm.mp4",
          tags: ["ava", "calm"]
        }
      ])
    ).toEqual([
      {
        title: "Ava calm",
        descriptor: "calm",
        start: 1,
        end: 4.4,
        outputName: "ava_calm.mp4",
        tags: ["ava", "calm"]
      }
    ]);
  });
});

describe("isSupportedThumbnailFile", () => {
  it("accepts common raster image files and rejects unsupported files", () => {
    expect(
      isSupportedThumbnailFile({ name: "lister.jpg", type: "image/jpeg" })
    ).toBe(true);
    expect(
      isSupportedThumbnailFile({ name: "lister.webp", type: "image/webp" })
    ).toBe(true);
    expect(
      isSupportedThumbnailFile({ name: "script.svg", type: "image/svg+xml" })
    ).toBe(false);
    expect(isSupportedThumbnailFile({ name: "voice.mp4", type: "video/mp4" })).toBe(
      false
    );
  });
});
