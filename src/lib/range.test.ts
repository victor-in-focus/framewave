import { describe, expect, it } from "vitest";
import { clampRange, getRangeValidation } from "./range";

describe("clampRange", () => {
  it("keeps start and end inside the media duration", () => {
    expect(clampRange(-2, 12, 10)).toEqual({ start: 0, end: 10 });
  });

  it("orders the range when start is after end", () => {
    expect(clampRange(6, 3, 10)).toEqual({ start: 3, end: 6 });
  });
});

describe("getRangeValidation", () => {
  it("accepts ranges up to five seconds", () => {
    expect(getRangeValidation(10, 14.8, 30)).toEqual({
      valid: true,
      message: null,
      duration: 4.8
    });
  });

  it("rejects empty ranges", () => {
    expect(getRangeValidation(4, 4, 20)).toMatchObject({
      valid: false,
      message: "Select a range longer than 0 seconds."
    });
  });

  it("accepts ranges longer than five seconds", () => {
    expect(getRangeValidation(0, 12.4, 20)).toEqual({
      valid: true,
      message: null,
      duration: 12.4
    });
  });
});
