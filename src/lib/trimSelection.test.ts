import { describe, expect, it } from "vitest";
import {
  buildThumbnailTimes,
  moveTrimSelection,
  percentToSeconds,
  resizeTrimEdge,
  secondsToPercent
} from "./trimSelection";

describe("seconds and percentage conversion", () => {
  it("maps seconds to percentages across the media duration", () => {
    expect(secondsToPercent(5, 20)).toBe(25);
  });

  it("maps percentages back to rounded seconds", () => {
    expect(percentToSeconds(33, 10)).toBe(3.3);
  });
});

describe("resizeTrimEdge", () => {
  it("allows moving start across the full selected range", () => {
    expect(
      resizeTrimEdge("start", 0, { start: 6, end: 14 }, 20)
    ).toEqual({ start: 0, end: 14 });
  });

  it("allows moving end across the full media duration", () => {
    expect(
      resizeTrimEdge("end", 16, { start: 4, end: 6 }, 20)
    ).toEqual({ start: 4, end: 16 });
  });
});

describe("moveTrimSelection", () => {
  it("moves the whole selected window while preserving duration", () => {
    expect(moveTrimSelection(8, { start: 1, end: 5 }, 12)).toEqual({
      start: 8,
      end: 12
    });
  });

  it("clamps the selected window to the beginning", () => {
    expect(moveTrimSelection(-2, { start: 3, end: 5 }, 12)).toEqual({
      start: 0,
      end: 2
    });
  });
});

describe("buildThumbnailTimes", () => {
  it("returns evenly distributed sample points inside the video duration", () => {
    expect(buildThumbnailTimes(10, 5)).toEqual([0, 2.5, 5, 7.5, 9.9]);
  });
});
