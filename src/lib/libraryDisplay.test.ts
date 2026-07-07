import { describe, expect, it } from "vitest";
import {
  getLibraryInitials,
  getLibraryDisplayTitle,
  isRecentLibraryClip,
  sortLibraryClips,
  type LibrarySortMode
} from "./libraryDisplay";
import type { LibraryClip } from "./libraryApi";

function clip(overrides: Partial<LibraryClip>): LibraryClip {
  return {
    id: "clip",
    sourceId: null,
    exportRunId: null,
    filename: "voice_reference_5s.mp4",
    title: "Reference",
    descriptor: "",
    startTime: 0,
    endTime: 5,
    duration: 5,
    favorite: false,
    createdAt: "2026-06-25T10:00:00.000Z",
    updatedAt: "2026-06-25T10:00:00.000Z",
    tags: [],
    mediaUrl: "blob:clip",
    downloadUrl: "blob:clip",
    thumbnailUrl: null,
    ...overrides
  };
}

describe("getLibraryDisplayTitle", () => {
  it("uses an explicit title when it is readable", () => {
    expect(getLibraryDisplayTitle(clip({ title: "Lister / pensive" }))).toBe(
      "Lister / pensive"
    );
  });

  it("falls back for one-character or blank titles", () => {
    expect(
      getLibraryDisplayTitle(
        clip({ title: "l / l", filename: "l_voice_reference_2s.mp4" })
      )
    ).toBe("Untitled reference");
    expect(getLibraryDisplayTitle(clip({ title: "" }))).toBe(
      "Untitled reference"
    );
  });
});

describe("getLibraryInitials", () => {
  it("builds compact initials for visual fallback thumbnails", () => {
    expect(getLibraryInitials(clip({ title: "Lister / pensive" }))).toBe("LP");
    expect(getLibraryInitials(clip({ title: "" }))).toBe("UR");
  });
});

describe("isRecentLibraryClip", () => {
  it("only marks clips from the last six hours as visually new", () => {
    const now = new Date("2026-06-26T12:00:00.000Z");

    expect(
      isRecentLibraryClip("2026-06-26T07:30:00.000Z", now)
    ).toBe(true);
    expect(
      isRecentLibraryClip("2026-06-26T05:30:00.000Z", now)
    ).toBe(false);
    expect(isRecentLibraryClip("not-a-date", now)).toBe(false);
  });
});

describe("sortLibraryClips", () => {
  const clips = [
    clip({
      id: "middle",
      title: "Beta",
      createdAt: "2026-06-25T09:00:00.000Z",
      duration: 2
    }),
    clip({
      id: "newest",
      title: "Alpha",
      createdAt: "2026-06-25T11:00:00.000Z",
      duration: 4
    }),
    clip({
      id: "longest",
      title: "Gamma",
      createdAt: "2026-06-25T08:00:00.000Z",
      duration: 5
    })
  ];

  it.each([
    ["recent", ["newest", "middle", "longest"]],
    ["longest", ["longest", "newest", "middle"]],
    ["az", ["newest", "middle", "longest"]]
  ] as Array<[LibrarySortMode, string[]]>)(
    "sorts clips by %s",
    (mode, expectedIds) => {
      expect(sortLibraryClips(clips, mode).map((item) => item.id)).toEqual(
        expectedIds
      );
    }
  );
});
