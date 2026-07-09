import {
  LIBRARY_CLIP_STORE,
  LIBRARY_META_STORE_NAME,
  PROJECT_FOLDER_STORE_NAME,
  PROJECT_STORE_NAME,
  databaseRequest,
  withDatabaseStores
} from "./libraryApi";
import {
  STARTER_FOLDER_NAMES,
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
  projectId?: string | null;
  folderId?: string | null;
  [key: string]: unknown;
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
      const now = new Date().toISOString();
      const project: Project = {
        id: createId(),
        name,
        createdAt: now,
        updatedAt: now
      };
      const folders: ProjectFolder[] = input.useStarterFolders
        ? STARTER_FOLDER_NAMES.map((folderName) => ({
            id: createId(),
            projectId: project.id,
            name: folderName,
            createdAt: now,
            updatedAt: now
          }))
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
