import { describe, expect, it } from "vitest";
import { formatFileSize, getSourceFileKind, isSupportedSourceFile } from "./file";

function fileWith(name: string, type: string, size = 1024): File {
  return new File(["x".repeat(size)], name, { type });
}

describe("isSupportedSourceFile", () => {
  it("accepts MP4, MOV, and WEBM files by mime type", () => {
    expect(isSupportedSourceFile(fileWith("clip.mp4", "video/mp4"))).toBe(true);
    expect(isSupportedSourceFile(fileWith("clip.mov", "video/quicktime"))).toBe(
      true
    );
    expect(isSupportedSourceFile(fileWith("clip.webm", "video/webm"))).toBe(
      true
    );
  });

  it("accepts common audio files that can become blank videos", () => {
    expect(isSupportedSourceFile(fileWith("line.wav", "audio/wav"))).toBe(true);
    expect(isSupportedSourceFile(fileWith("take.mp3", "audio/mpeg"))).toBe(true);
    expect(isSupportedSourceFile(fileWith("voice.m4a", "audio/mp4"))).toBe(true);
  });

  it("falls back to extension when mime type is missing", () => {
    expect(isSupportedSourceFile(fileWith("clip.MOV", ""))).toBe(true);
    expect(isSupportedSourceFile(fileWith("clip.FLAC", ""))).toBe(true);
  });

  it("rejects unsupported files", () => {
    expect(isSupportedSourceFile(fileWith("notes.txt", "text/plain"))).toBe(false);
  });
});

describe("getSourceFileKind", () => {
  it("classifies supported video and audio files", () => {
    expect(getSourceFileKind(fileWith("clip.mp4", "video/mp4"))).toBe("video");
    expect(getSourceFileKind(fileWith("line.wav", "audio/wav"))).toBe("audio");
    expect(getSourceFileKind(fileWith("notes.txt", "text/plain"))).toBe(
      "unsupported"
    );
  });
});

describe("formatFileSize", () => {
  it("formats megabytes with one decimal place", () => {
    expect(formatFileSize(2_621_440)).toBe("2.5 MB");
  });
});
