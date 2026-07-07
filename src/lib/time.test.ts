import { describe, expect, it } from "vitest";
import { formatClockTime, formatDuration } from "./time";

describe("formatClockTime", () => {
  it("formats seconds as minutes, seconds, and tenths", () => {
    expect(formatClockTime(72.34)).toBe("01:12.3");
  });

  it("treats invalid values as zero", () => {
    expect(formatClockTime(Number.NaN)).toBe("00:00.0");
  });
});

describe("formatDuration", () => {
  it("formats duration with one decimal place", () => {
    expect(formatDuration(4.24)).toBe("4.2s");
  });

  it("never displays negative durations", () => {
    expect(formatDuration(-2)).toBe("0.0s");
  });
});
