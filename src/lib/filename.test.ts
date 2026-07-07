import { describe, expect, it } from "vitest";
import { buildReferenceFilename, slugifyPart } from "./filename";

describe("slugifyPart", () => {
  it("normalizes names into lowercase underscore-safe parts", () => {
    expect(slugifyPart("Emily Rose / Calm take")).toBe("emily_rose_calm_take");
  });

  it("returns an empty string when no usable characters remain", () => {
    expect(slugifyPart("  ---  ")).toBe("");
  });
});

describe("buildReferenceFilename", () => {
  it("builds a compact name-based filename with rounded duration", () => {
    expect(
      buildReferenceFilename({
        characterName: "Emily",
        descriptor: "calm",
        durationSeconds: 4.2
      })
    ).toBe("emily_calm_4s.mp4");
  });

  it("falls back when no name or descriptor is entered", () => {
    expect(
      buildReferenceFilename({
        characterName: "",
        descriptor: "",
        durationSeconds: 5
      })
    ).toBe("voice_reference_5s.mp4");
  });

  it("omits duration when duration is not usable", () => {
    expect(
      buildReferenceFilename({
        characterName: "Scene 02",
        descriptor: "Ref #1",
        durationSeconds: Number.NaN
      })
    ).toBe("scene_02_ref_1.mp4");
  });

  it("supports hyphenated filenames and optional duration", () => {
    expect(
      buildReferenceFilename({
        characterName: "Emily",
        descriptor: "Calm take",
        durationSeconds: 4.2,
        separator: "-",
        includeDuration: false
      })
    ).toBe("emily-calm-take.mp4");
  });
});
