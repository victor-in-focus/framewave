import {
  LIBRARY_CLIP_STORE,
  LIBRARY_META_STORE_NAME,
  PROJECT_FOLDER_STORE_NAME,
  PROJECT_STORE_NAME,
  databaseRequest,
  fetchLibrary,
  withDatabaseStores
} from "./libraryApi";
import {
  STARTER_FOLDER_NAMES,
  nextRestoredName,
  normalizeAssignment,
  validateFolderName,
  validateProjectName,
  type Project,
  type ProjectFolder
} from "./projectLibrary";

const PROJECT_LIBRARY_SCHEMA_ID = "project-library-schema";
const PROJECT_LIBRARY_SCHEMA_VERSION = 1;

interface StoredClipAssignment {
  id: string;
  updatedAt: string;
  projectId?: string | null;
  folderId?: string | null;
  [key: string]: unknown;
}

export type MoveDestination =
  | { kind: "quick" }
  | { kind: "project-unfiled"; projectId: string }
  | { kind: "folder"; projectId: string; folderId: string };

interface ClipUndoAssignment {
  id: string;
  projectId: string | null;
  folderId: string | null;
  postDeleteUpdatedAt: string;
}

export interface FolderUndoSnapshot {
  folder: ProjectFolder;
  clips: ClipUndoAssignment[];
}

export interface ProjectUndoSnapshot {
  project: Project;
  folders: ProjectFolder[];
  clips: ClipUndoAssignment[];
}

interface SchemaMarker {
  id: typeof PROJECT_LIBRARY_SCHEMA_ID;
  version: number;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function creationOrder<T extends { createdAt: string }>(left: T, right: T): number {
  return left.createdAt.localeCompare(right.createdAt);
}

function nextUpdatedAt(previous: string): string {
  const previousTime = Date.parse(previous);
  return new Date(
    Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)
  ).toISOString();
}

async function fetchUpdatedClip(clipId: string) {
  const clip = (await fetchLibrary("")).find((candidate) => candidate.id === clipId);
  if (!clip) {
    throw new Error("Library clip was not found.");
  }
  return clip;
}

function validationValue(validation: {
  valid: boolean;
  value: string;
  error: string | null;
}): string {
  if (!validation.valid) {
    throw new Error(validation.error ?? "Use a different name.");
  }
  return validation.value;
}

export async function initializeProjectLibrary(): Promise<void> {
  await withDatabaseStores(
    [
      LIBRARY_CLIP_STORE,
      PROJECT_STORE_NAME,
      PROJECT_FOLDER_STORE_NAME,
      LIBRARY_META_STORE_NAME
    ],
    "readwrite",
    async (stores) => {
      const marker = await databaseRequest(
        stores[LIBRARY_META_STORE_NAME].get(
          PROJECT_LIBRARY_SCHEMA_ID
        ) as IDBRequest<SchemaMarker | undefined>
      );
      if ((marker?.version ?? 0) >= PROJECT_LIBRARY_SCHEMA_VERSION) {
        return;
      }

      const [projects, folders, clips] = await Promise.all([
        databaseRequest(
          stores[PROJECT_STORE_NAME].getAll() as IDBRequest<Project[]>
        ),
        databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].getAll() as IDBRequest<
            ProjectFolder[]
          >
        ),
        databaseRequest(
          stores[LIBRARY_CLIP_STORE].getAll() as IDBRequest<
            StoredClipAssignment[]
          >
        )
      ]);

      for (const clip of clips) {
        const assignment = normalizeAssignment(clip, projects, folders);
        if (
          (clip.projectId ?? null) !== assignment.projectId ||
          (clip.folderId ?? null) !== assignment.folderId
        ) {
          await databaseRequest(
            stores[LIBRARY_CLIP_STORE].put({ ...clip, ...assignment })
          );
        }
      }

      await databaseRequest(
        stores[LIBRARY_META_STORE_NAME].put({
          id: PROJECT_LIBRARY_SCHEMA_ID,
          version: PROJECT_LIBRARY_SCHEMA_VERSION
        } satisfies SchemaMarker)
      );
    }
  );
}

export async function fetchProjects(): Promise<Project[]> {
  const projects = await withDatabaseStores(
    [PROJECT_STORE_NAME],
    "readonly",
    (stores) =>
      databaseRequest(
        stores[PROJECT_STORE_NAME].getAll() as IDBRequest<Project[]>
      )
  );
  return projects.sort(creationOrder);
}

export async function fetchProjectFolders(): Promise<ProjectFolder[]> {
  const folders = await withDatabaseStores(
    [PROJECT_FOLDER_STORE_NAME],
    "readonly",
    (stores) =>
      databaseRequest(
        stores[PROJECT_FOLDER_STORE_NAME].getAll() as IDBRequest<
          ProjectFolder[]
        >
      )
  );
  return folders.sort(creationOrder);
}

export async function createProject(input: {
  name: string;
  useStarterFolders?: boolean;
}): Promise<{ project: Project; folders: ProjectFolder[] }> {
  return withDatabaseStores(
    [PROJECT_STORE_NAME, PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const existing = await databaseRequest(
        stores[PROJECT_STORE_NAME].getAll() as IDBRequest<Project[]>
      );
      const name = validationValue(validateProjectName(input.name, existing));
      const createdTime = Date.now();
      const now = new Date(createdTime).toISOString();
      const project: Project = {
        id: createId(),
        name,
        createdAt: now,
        updatedAt: now
      };
      const folders: ProjectFolder[] = input.useStarterFolders
        ? STARTER_FOLDER_NAMES.map((folderName, index) => {
            const folderTime = new Date(createdTime + index + 1).toISOString();
            return {
              id: createId(),
              projectId: project.id,
              name: folderName,
              createdAt: folderTime,
              updatedAt: folderTime
            };
          })
        : [];

      await databaseRequest(stores[PROJECT_STORE_NAME].put(project));
      for (const folder of folders) {
        await databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].put(folder)
        );
      }
      return { project, folders };
    }
  );
}

export async function renameProject(
  projectId: string,
  name: string
): Promise<Project> {
  return withDatabaseStores([PROJECT_STORE_NAME], "readwrite", async (stores) => {
    const store = stores[PROJECT_STORE_NAME];
    const [project, projects] = await Promise.all([
      databaseRequest(store.get(projectId) as IDBRequest<Project | undefined>),
      databaseRequest(store.getAll() as IDBRequest<Project[]>)
    ]);
    if (!project) {
      throw new Error("Project was not found.");
    }
    const next: Project = {
      ...project,
      name: validationValue(validateProjectName(name, projects, project.name)),
      updatedAt: new Date().toISOString()
    };
    await databaseRequest(store.put(next));
    return next;
  });
}

export async function createProjectFolder(
  projectId: string,
  name: string
): Promise<ProjectFolder> {
  return withDatabaseStores(
    [PROJECT_STORE_NAME, PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const [project, folders] = await Promise.all([
        databaseRequest(
          stores[PROJECT_STORE_NAME].get(projectId) as IDBRequest<
            Project | undefined
          >
        ),
        databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].getAll() as IDBRequest<
            ProjectFolder[]
          >
        )
      ]);
      if (!project) {
        throw new Error("Project was not found.");
      }
      const now = new Date().toISOString();
      const folder: ProjectFolder = {
        id: createId(),
        projectId,
        name: validationValue(validateFolderName(name, projectId, folders)),
        createdAt: now,
        updatedAt: now
      };
      await databaseRequest(
        stores[PROJECT_FOLDER_STORE_NAME].put(folder)
      );
      return folder;
    }
  );
}

export async function renameProjectFolder(
  folderId: string,
  name: string
): Promise<ProjectFolder> {
  return withDatabaseStores(
    [PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const store = stores[PROJECT_FOLDER_STORE_NAME];
      const [folder, folders] = await Promise.all([
        databaseRequest(
          store.get(folderId) as IDBRequest<ProjectFolder | undefined>
        ),
        databaseRequest(store.getAll() as IDBRequest<ProjectFolder[]>)
      ]);
      if (!folder) {
        throw new Error("Folder was not found.");
      }
      const next: ProjectFolder = {
        ...folder,
        name: validationValue(
          validateFolderName(name, folder.projectId, folders, folder.name)
        ),
        updatedAt: new Date().toISOString()
      };
      await databaseRequest(store.put(next));
      return next;
    }
  );
}

export async function moveReference(
  clipId: string,
  destination: MoveDestination
) {
  await withDatabaseStores(
    [LIBRARY_CLIP_STORE, PROJECT_STORE_NAME, PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const clip = await databaseRequest(
        stores[LIBRARY_CLIP_STORE].get(clipId) as IDBRequest<
          StoredClipAssignment | undefined
        >
      );
      if (!clip) {
        throw new Error("Library clip was not found.");
      }

      let projectId: string | null = null;
      let folderId: string | null = null;
      if (destination.kind !== "quick") {
        const project = await databaseRequest(
          stores[PROJECT_STORE_NAME].get(destination.projectId) as IDBRequest<
            Project | undefined
          >
        );
        if (!project) {
          throw new Error("Project was not found.");
        }
        projectId = project.id;
      }
      if (destination.kind === "folder") {
        const folder = await databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].get(
            destination.folderId
          ) as IDBRequest<ProjectFolder | undefined>
        );
        if (!folder || folder.projectId !== destination.projectId) {
          throw new Error("That folder does not belong to this project.");
        }
        folderId = folder.id;
      }

      await databaseRequest(
        stores[LIBRARY_CLIP_STORE].put({
          ...clip,
          projectId,
          folderId,
          updatedAt: nextUpdatedAt(clip.updatedAt)
        })
      );
    }
  );
  return fetchUpdatedClip(clipId);
}

export async function createProjectAndMoveReference(
  clipId: string,
  input: { name: string; useStarterFolders?: boolean }
) {
  const result = await withDatabaseStores(
    [LIBRARY_CLIP_STORE, PROJECT_STORE_NAME, PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const [clip, projects] = await Promise.all([
        databaseRequest(
          stores[LIBRARY_CLIP_STORE].get(clipId) as IDBRequest<
            StoredClipAssignment | undefined
          >
        ),
        databaseRequest(
          stores[PROJECT_STORE_NAME].getAll() as IDBRequest<Project[]>
        )
      ]);
      if (!clip) {
        throw new Error("Library clip was not found.");
      }
      const createdTime = Date.now();
      const now = new Date(createdTime).toISOString();
      const project: Project = {
        id: createId(),
        name: validationValue(validateProjectName(input.name, projects)),
        createdAt: now,
        updatedAt: now
      };
      const folders: ProjectFolder[] = input.useStarterFolders
        ? STARTER_FOLDER_NAMES.map((name, index) => {
            const folderTime = new Date(createdTime + index + 1).toISOString();
            return {
              id: createId(),
              projectId: project.id,
              name,
              createdAt: folderTime,
              updatedAt: folderTime
            };
          })
        : [];

      await databaseRequest(stores[PROJECT_STORE_NAME].put(project));
      for (const folder of folders) {
        await databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].put(folder)
        );
      }
      await databaseRequest(
        stores[LIBRARY_CLIP_STORE].put({
          ...clip,
          projectId: project.id,
          folderId: null,
          updatedAt: nextUpdatedAt(clip.updatedAt)
        })
      );
      return { project, folders };
    }
  );

  return { ...result, clip: await fetchUpdatedClip(clipId) };
}

export async function createFolderAndMoveReference(
  clipId: string,
  projectId: string,
  name: string
) {
  const folder = await withDatabaseStores(
    [LIBRARY_CLIP_STORE, PROJECT_STORE_NAME, PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const [clip, project, folders] = await Promise.all([
        databaseRequest(
          stores[LIBRARY_CLIP_STORE].get(clipId) as IDBRequest<
            StoredClipAssignment | undefined
          >
        ),
        databaseRequest(
          stores[PROJECT_STORE_NAME].get(projectId) as IDBRequest<
            Project | undefined
          >
        ),
        databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].getAll() as IDBRequest<
            ProjectFolder[]
          >
        )
      ]);
      if (!clip) {
        throw new Error("Library clip was not found.");
      }
      if (!project) {
        throw new Error("Project was not found.");
      }
      const now = new Date().toISOString();
      const nextFolder: ProjectFolder = {
        id: createId(),
        projectId,
        name: validationValue(validateFolderName(name, projectId, folders)),
        createdAt: now,
        updatedAt: now
      };
      await databaseRequest(
        stores[PROJECT_FOLDER_STORE_NAME].put(nextFolder)
      );
      await databaseRequest(
        stores[LIBRARY_CLIP_STORE].put({
          ...clip,
          projectId,
          folderId: nextFolder.id,
          updatedAt: nextUpdatedAt(clip.updatedAt)
        })
      );
      return nextFolder;
    }
  );
  return { folder, clip: await fetchUpdatedClip(clipId) };
}

export async function deleteProjectFolder(
  folderId: string
): Promise<FolderUndoSnapshot> {
  return withDatabaseStores(
    [LIBRARY_CLIP_STORE, PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const [folder, clips] = await Promise.all([
        databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].get(folderId) as IDBRequest<
            ProjectFolder | undefined
          >
        ),
        databaseRequest(
          stores[LIBRARY_CLIP_STORE].getAll() as IDBRequest<
            StoredClipAssignment[]
          >
        )
      ]);
      if (!folder) {
        throw new Error("Folder was not found.");
      }

      const affected = clips.filter(
        (clip) => clip.projectId === folder.projectId && clip.folderId === folder.id
      );
      const snapshots: ClipUndoAssignment[] = [];
      for (const clip of affected) {
        const updatedAt = nextUpdatedAt(clip.updatedAt);
        snapshots.push({
          id: clip.id,
          projectId: folder.projectId,
          folderId: folder.id,
          postDeleteUpdatedAt: updatedAt
        });
        await databaseRequest(
          stores[LIBRARY_CLIP_STORE].put({
            ...clip,
            folderId: null,
            updatedAt
          })
        );
      }
      await databaseRequest(
        stores[PROJECT_FOLDER_STORE_NAME].delete(folder.id)
      );
      return { folder, clips: snapshots };
    }
  );
}

export async function restoreProjectFolder(
  snapshot: FolderUndoSnapshot
): Promise<void> {
  await withDatabaseStores(
    [LIBRARY_CLIP_STORE, PROJECT_STORE_NAME, PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const [project, folders] = await Promise.all([
        databaseRequest(
          stores[PROJECT_STORE_NAME].get(snapshot.folder.projectId) as IDBRequest<
            Project | undefined
          >
        ),
        databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].getAll() as IDBRequest<
            ProjectFolder[]
          >
        )
      ]);
      if (!project) {
        throw new Error("Project was not found.");
      }
      const siblingNames = folders
        .filter((folder) => folder.projectId === snapshot.folder.projectId)
        .map((folder) => folder.name);
      const hasConflict = siblingNames.some(
        (name) => name.toLocaleLowerCase() === snapshot.folder.name.toLocaleLowerCase()
      );
      const folder = {
        ...snapshot.folder,
        name: hasConflict
          ? nextRestoredName(snapshot.folder.name, siblingNames)
          : snapshot.folder.name,
        updatedAt: new Date().toISOString()
      };
      await databaseRequest(
        stores[PROJECT_FOLDER_STORE_NAME].put(folder)
      );

      for (const saved of snapshot.clips) {
        const clip = await databaseRequest(
          stores[LIBRARY_CLIP_STORE].get(saved.id) as IDBRequest<
            StoredClipAssignment | undefined
          >
        );
        if (
          clip &&
          clip.projectId === saved.projectId &&
          !clip.folderId &&
          clip.updatedAt === saved.postDeleteUpdatedAt
        ) {
          await databaseRequest(
            stores[LIBRARY_CLIP_STORE].put({
              ...clip,
              folderId: saved.folderId,
              updatedAt: nextUpdatedAt(clip.updatedAt)
            })
          );
        }
      }
    }
  );
}

export async function deleteProject(
  projectId: string
): Promise<ProjectUndoSnapshot> {
  return withDatabaseStores(
    [LIBRARY_CLIP_STORE, PROJECT_STORE_NAME, PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const [project, folders, clips] = await Promise.all([
        databaseRequest(
          stores[PROJECT_STORE_NAME].get(projectId) as IDBRequest<
            Project | undefined
          >
        ),
        databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].getAll() as IDBRequest<
            ProjectFolder[]
          >
        ),
        databaseRequest(
          stores[LIBRARY_CLIP_STORE].getAll() as IDBRequest<
            StoredClipAssignment[]
          >
        )
      ]);
      if (!project) {
        throw new Error("Project was not found.");
      }
      const projectFolders = folders.filter(
        (folder) => folder.projectId === project.id
      );
      const affected = clips.filter((clip) => clip.projectId === project.id);
      const snapshots: ClipUndoAssignment[] = [];
      for (const clip of affected) {
        const updatedAt = nextUpdatedAt(clip.updatedAt);
        snapshots.push({
          id: clip.id,
          projectId: project.id,
          folderId: clip.folderId ?? null,
          postDeleteUpdatedAt: updatedAt
        });
        await databaseRequest(
          stores[LIBRARY_CLIP_STORE].put({
            ...clip,
            projectId: null,
            folderId: null,
            updatedAt
          })
        );
      }
      for (const folder of projectFolders) {
        await databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].delete(folder.id)
        );
      }
      await databaseRequest(stores[PROJECT_STORE_NAME].delete(project.id));
      return { project, folders: projectFolders, clips: snapshots };
    }
  );
}

export async function restoreProject(snapshot: ProjectUndoSnapshot): Promise<void> {
  await withDatabaseStores(
    [LIBRARY_CLIP_STORE, PROJECT_STORE_NAME, PROJECT_FOLDER_STORE_NAME],
    "readwrite",
    async (stores) => {
      const [projects, existingFolders] = await Promise.all([
        databaseRequest(
          stores[PROJECT_STORE_NAME].getAll() as IDBRequest<Project[]>
        ),
        databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].getAll() as IDBRequest<
            ProjectFolder[]
          >
        )
      ]);
      const projectNames = projects.map((project) => project.name);
      const projectConflict = projectNames.some(
        (name) => name.toLocaleLowerCase() === snapshot.project.name.toLocaleLowerCase()
      );
      const project: Project = {
        ...snapshot.project,
        name: projectConflict
          ? nextRestoredName(snapshot.project.name, projectNames)
          : snapshot.project.name,
        updatedAt: new Date().toISOString()
      };
      await databaseRequest(stores[PROJECT_STORE_NAME].put(project));

      const usedFolderNames = existingFolders
        .filter((folder) => folder.projectId === project.id)
        .map((folder) => folder.name);
      for (const savedFolder of snapshot.folders) {
        const hasConflict = usedFolderNames.some(
          (name) => name.toLocaleLowerCase() === savedFolder.name.toLocaleLowerCase()
        );
        const name = hasConflict
          ? nextRestoredName(savedFolder.name, usedFolderNames)
          : savedFolder.name;
        usedFolderNames.push(name);
        await databaseRequest(
          stores[PROJECT_FOLDER_STORE_NAME].put({
            ...savedFolder,
            name,
            updatedAt: new Date().toISOString()
          })
        );
      }

      for (const saved of snapshot.clips) {
        const clip = await databaseRequest(
          stores[LIBRARY_CLIP_STORE].get(saved.id) as IDBRequest<
            StoredClipAssignment | undefined
          >
        );
        if (
          clip &&
          !clip.projectId &&
          !clip.folderId &&
          clip.updatedAt === saved.postDeleteUpdatedAt
        ) {
          await databaseRequest(
            stores[LIBRARY_CLIP_STORE].put({
              ...clip,
              projectId: saved.projectId,
              folderId: saved.folderId,
              updatedAt: nextUpdatedAt(clip.updatedAt)
            })
          );
        }
      }
    }
  );
}
