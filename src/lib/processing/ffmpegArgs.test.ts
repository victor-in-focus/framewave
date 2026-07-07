import { describe, expect, it } from "vitest";
import {
  buildBlankClipArgs,
  buildEncodeAudioArgs,
  buildExtractAudioArgs,
  describeExportFailure,
  inputFilenameFor
} from "./ffmpegArgs";

describe("buildBlankClipArgs", () => {
  it("trims the source and muxes it with a generated black video track", () => {
    const args = buildBlankClipArgs("input.mp4", "output.mp4", 1.5, 4);

    expect(args.slice(0, 6)).toEqual([
      "-ss",
      "1.500",
      "-t",
      "4.000",
      "-i",
      "input.mp4"
    ]);
    expect(args).toContain("color=black:size=1280x720:rate=30");
    expect(args.join(" ")).toContain("-map 1:v -map 0:a:0");
    expect(args.at(-1)).toBe("output.mp4");
  });

  it("clamps invalid times instead of producing broken commands", () => {
    const args = buildBlankClipArgs("input.mp4", "output.mp4", -2, Number.NaN);
    expect(args[1]).toBe("0.000");
    expect(args[3]).toBe("0.000");
  });
});

describe("audio enhancement pipeline args", () => {
  it("extracts trimmed audio as WAV", () => {
    const args = buildExtractAudioArgs("input.mov", "audio.wav", 0, 3);
    expect(args.join(" ")).toContain("-vn -c:a pcm_s16le -f wav audio.wav");
  });

  it("encodes enhanced audio with a black video track", () => {
    const args = buildEncodeAudioArgs("audio.wav", "output.mp4", 3);
    expect(args).toContain("color=black:size=1280x720:rate=30");
    expect(args.at(-1)).toBe("output.mp4");
  });
});

describe("describeExportFailure", () => {
  it("recognizes sources without an audio track", () => {
    expect(
      describeExportFailure(["Stream map '0:a:0' matches no streams."])
    ).toBe("This file does not seem to have an audio track.");
  });

  it("falls back to the last log line for unknown failures", () => {
    expect(describeExportFailure(["something", "went wrong"])).toBe(
      "Local processing failed: went wrong"
    );
    expect(describeExportFailure([])).toBe("Local processing failed.");
  });
});

describe("inputFilenameFor", () => {
  it("keeps the source extension so FFmpeg picks the right demuxer", () => {
    expect(inputFilenameFor({ name: "Take 3.MOV", type: "video/quicktime" })).toBe(
      "input.mov"
    );
    expect(inputFilenameFor({ name: "voice.mp3", type: "audio/mpeg" })).toBe(
      "input.mp3"
    );
  });

  it("derives the extension from the MIME type when the name has none", () => {
    expect(inputFilenameFor({ name: "clipboard", type: "audio/wav" })).toBe(
      "input.wav"
    );
    expect(inputFilenameFor({ name: "unknown", type: "" })).toBe("input.mp4");
  });
});
