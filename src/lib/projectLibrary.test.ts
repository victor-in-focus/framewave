import { describe, expect, it } from "vitest";
import {
  filterClipsByLocation,
  getLocationLabel,
  getProjectCounts,
  nextRestoredName,
  normalizeAssignment,
  validateFolderName,
  validateProjectName,
  type OrganizedLibraryClip,
  type Project,
  type ProjectFolder
} from "./projectLibrary";

const projects: Project[] = [
  {
    id: "p1",
    name: "Midnight Train",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
  }
];

const folders: ProjectFolder[] = [
  {
    id: "f1",
    projectId: "p1",
    name: "Finals",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
  }
];

function clip(
  id: string,
  projectId: string | null,
  folderId: string | null
): OrganizedLibraryClip {
  return {
    id,
    sourceId: null,
    exportRunId: null,
    filename: `${id}.mp4`,
    title: id,
    descriptor: "",
    startTime: 0,
    endTime: 5,
    duration: 5,
    favorite: false,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    tags: [],
    mediaUrl: `blob:${id}`,
    downloadUrl: `blob:${id}`,
    thumbnailUrl: null,
    projectId,
    folderId
  };
}

const clips = [
  clip("quick", null, null),
  clip("unfiled", "p1", null),
  clip("folder-a", "p1", "f1"),
  clip("folder-b", "p1", "f1")
];

describe("project and folder names", () => {
  it("trims valid names", () => {
    expect(validateProjectName("  New Film  ", projects)).toEqual({
      valid: true,
      value: "New Film",
      error: null
    });
  });

  it("rejects empty, long, and case-insensitive duplicate project names", () => {
    expect(validateProjectName("   ", projects).valid).toBe(false);
    expect(validateProjectName("x".repeat(81), projects).valid).toBe(false);
    expect(validateProjectName(" midnight train ", projects).valid).toBe(false);
  });

  it("scopes duplicate folder names to one project", () => {
    expect(validateFolderName(" finals ", "p1", folders).valid).toBe(false);
    expect(validateFolderName("Finals", "p2", folders).valid).toBe(true);
  });
});

describe("library locations", () => {
  it("filters all, quick, project, unfiled, and folder locations", () => {
    expect(filterClipsByLocation(clips, { kind: "all" })).toHaveLength(4);
    expect(
      filterClipsByLocation(clips, { kind: "quick" }).map(({ id }) => id)
    ).toEqual(["quick"]);
    expect(
      filterClipsByLocation(clips, {
        kind: "project-all",
        projectId: "p1"
      })
    ).toHaveLength(3);
    expect(
      filterClipsByLocation(clips, {
        kind: "project-unfiled",
        projectId: "p1"
      }).map(({ id }) => id)
    ).toEqual(["unfiled"]);
    expect(
      filterClipsByLocation(clips, {
        kind: "folder",
        projectId: "p1",
        folderId: "f1"
      })
    ).toHaveLength(2);
  });

  it("keeps navigation counts absolute", () => {
    expect(getProjectCounts(clips, projects, folders)).toEqual({
      all: 4,
      quick: 1,
      projects: {
        p1: {
          all: 3,
          unfiled: 1,
          folders: { f1: 2 }
        }
      }
    });
  });

  it("builds compact location labels", () => {
    expect(
      getLocationLabel(
        { kind: "folder", projectId: "p1", folderId: "f1" },
        projects,
        folders
      )
    ).toBe("Midnight Train / Finals");
  });
});

describe("assignment recovery", () => {
  it("sends missing projects and orphan folders to Quick exports", () => {
    expect(
      normalizeAssignment(
        { projectId: "missing", folderId: "f1" },
        projects,
        folders
      )
    ).toEqual({ projectId: null, folderId: null });
    expect(
      normalizeAssignment({ projectId: null, folderId: "f1" }, projects, folders)
    ).toEqual({ projectId: null, folderId: null });
  });

  it("keeps a valid project and clears a missing or mismatched folder", () => {
    expect(
      normalizeAssignment(
        { projectId: "p1", folderId: "missing" },
        projects,
        folders
      )
    ).toEqual({ projectId: "p1", folderId: null });
  });

  it("finds a unique restored name", () => {
    expect(nextRestoredName("Finals", ["Finals", "Finals restored"])).toBe(
      "Finals restored 2"
    );
  });
});
