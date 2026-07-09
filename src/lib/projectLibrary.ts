import type { LibraryClip } from "./libraryApi";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFolder {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClipAssignment {
  projectId: string | null;
  folderId: string | null;
}

export type OrganizedLibraryClip = LibraryClip & ClipAssignment;

export type LibraryLocation =
  | { kind: "all" }
  | { kind: "quick" }
  | { kind: "project-all"; projectId: string }
  | { kind: "project-unfiled"; projectId: string }
  | { kind: "folder"; projectId: string; folderId: string };

export interface NameValidation {
  valid: boolean;
  value: string;
  error: string | null;
}

export interface ProjectCounts {
  all: number;
  quick: number;
  projects: Record<
    string,
    { all: number; unfiled: number; folders: Record<string, number> }
  >;
}

export const STARTER_FOLDER_NAMES = [
  "Character A",
  "Character B",
  "Scene 01",
  "Pickups",
  "Finals"
] as const;

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function validateName(
  value: string,
  existingNames: string[],
  currentName?: string
): NameValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, value: trimmed, error: "Enter a name." };
  }
  if (trimmed.length > 80) {
    return {
      valid: false,
      value: trimmed,
      error: "Use 80 characters or fewer."
    };
  }

  const candidate = normalizedName(trimmed);
  const current = currentName ? normalizedName(currentName) : null;
  const duplicate = existingNames.some(
    (name) => normalizedName(name) === candidate && normalizedName(name) !== current
  );
  if (duplicate) {
    return {
      valid: false,
      value: trimmed,
      error: "That name is already in use."
    };
  }

  return { valid: true, value: trimmed, error: null };
}

export function validateProjectName(
  value: string,
  projects: Project[],
  currentName?: string
): NameValidation {
  return validateName(
    value,
    projects.map((project) => project.name),
    currentName
  );
}

export function validateFolderName(
  value: string,
  projectId: string,
  folders: ProjectFolder[],
  currentName?: string
): NameValidation {
  return validateName(
    value,
    folders
      .filter((folder) => folder.projectId === projectId)
      .map((folder) => folder.name),
    currentName
  );
}

export function filterClipsByLocation<T extends ClipAssignment>(
  clips: T[],
  location: LibraryLocation
): T[] {
  if (location.kind === "all") {
    return [...clips];
  }
  if (location.kind === "quick") {
    return clips.filter((clip) => !clip.projectId);
  }
  if (location.kind === "project-all") {
    return clips.filter((clip) => clip.projectId === location.projectId);
  }
  if (location.kind === "project-unfiled") {
    return clips.filter(
      (clip) => clip.projectId === location.projectId && !clip.folderId
    );
  }
  return clips.filter(
    (clip) =>
      clip.projectId === location.projectId && clip.folderId === location.folderId
  );
}

export function getProjectCounts(
  clips: ClipAssignment[],
  projects: Project[],
  folders: ProjectFolder[]
): ProjectCounts {
  const counts: ProjectCounts = {
    all: clips.length,
    quick: clips.filter((clip) => !clip.projectId).length,
    projects: {}
  };

  for (const project of projects) {
    const projectClips = clips.filter((clip) => clip.projectId === project.id);
    const folderCounts: Record<string, number> = {};
    for (const folder of folders.filter(
      (candidate) => candidate.projectId === project.id
    )) {
      folderCounts[folder.id] = projectClips.filter(
        (clip) => clip.folderId === folder.id
      ).length;
    }
    counts.projects[project.id] = {
      all: projectClips.length,
      unfiled: projectClips.filter((clip) => !clip.folderId).length,
      folders: folderCounts
    };
  }

  return counts;
}

export function getLocationLabel(
  location: LibraryLocation,
  projects: Project[],
  folders: ProjectFolder[]
): string {
  if (location.kind === "all") {
    return "All references";
  }
  if (location.kind === "quick") {
    return "Quick exports";
  }

  const project = projects.find((candidate) => candidate.id === location.projectId);
  const projectName = project?.name ?? "Project";
  if (location.kind === "project-all") {
    return projectName;
  }
  if (location.kind === "project-unfiled") {
    return `${projectName} / Unfiled`;
  }
  const folder = folders.find((candidate) => candidate.id === location.folderId);
  return `${projectName} / ${folder?.name ?? "Folder"}`;
}

export function normalizeAssignment(
  assignment: Partial<ClipAssignment>,
  projects: Project[],
  folders: ProjectFolder[]
): ClipAssignment {
  const projectId = assignment.projectId ?? null;
  if (!projectId || !projects.some((project) => project.id === projectId)) {
    return { projectId: null, folderId: null };
  }

  const folderId = assignment.folderId ?? null;
  const validFolder = folders.some(
    (folder) => folder.id === folderId && folder.projectId === projectId
  );
  return { projectId, folderId: validFolder ? folderId : null };
}

export function nextRestoredName(baseName: string, existingNames: string[]): string {
  const existing = new Set(existingNames.map(normalizedName));
  let candidate = `${baseName.trim()} restored`;
  let suffix = 2;
  while (existing.has(normalizedName(candidate))) {
    candidate = `${baseName.trim()} restored ${suffix}`;
    suffix += 1;
  }
  return candidate;
}
