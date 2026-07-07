import { describe, expect, it } from "vitest";
import { bucketPeaks } from "./waveform";

describe("bucketPeaks", () => {
  it("reduces samples to per-bucket peaks normalized to the loudest bucket", () => {
    const channel = new Float32Array([0.1, 0.2, -0.5, 0.05, 0.25, -0.1]);
    const peaks = bucketPeaks([channel], 3);

    expect(peaks).toHaveLength(3);
    expect(peaks[0]).toBeCloseTo(0.2 / 0.5);
    expect(peaks[1]).toBeCloseTo(1);
    expect(peaks[2]).toBeCloseTo(0.25 / 0.5);
  });

  it("takes the loudest channel when several are present", () => {
    const quiet = new Float32Array([0.1, 0.1]);
    const loud = new Float32Array([0.4, -0.8]);
    const peaks = bucketPeaks([quiet, loud], 2);

    expect(peaks[0]).toBeCloseTo(0.5);
    expect(peaks[1]).toBeCloseTo(1);
  });

  it("handles silence and empty input without dividing by zero", () => {
    expect(bucketPeaks([new Float32Array([0, 0, 0, 0])], 2)).toEqual([0, 0]);
    expect(bucketPeaks([], 4)).toEqual([]);
    expect(bucketPeaks([new Float32Array(0)], 4)).toEqual([]);
  });

  it("pads with zeros when there are more buckets than samples", () => {
    const peaks = bucketPeaks([new Float32Array([0.5])], 3);
    expect(peaks).toEqual([1, 0, 0]);
  });
});
