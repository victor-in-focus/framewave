import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  createProject,
  createProjectFolder,
  fetchProjectFolders,
  fetchProjects,
  initializeProjectLibrary,
  renameProject,
  renameProjectFolder
} from "./projectApi";

const DB_NAME = "FrameWaveLibraryDB";
const LEGACY_DB_NAME = ["Voice", "Blank", "LibraryDB"].join("");

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function seedStore(storeName: string, records: unknown[]): Promise<void> {
  await withDatabaseStores([storeName], "readwrite", async (stores) => {
    for (const record of records) {
      await databaseRequest(stores[storeName].put(record));
    }
  });
}

function rawClip(
  id: string,
  projectId: string | null,
  folderId: string | null
) {
  return {
    id,
    sourceId: null,
    exportRunId: null,
    filename: `${id}.mp4`,
    title: id,
    descriptor: "",
    startTime: 0,
    endTime: 2,
    duration: 2,
    favorite: false,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    projectId,
    folderId,
    tags: [],
    blob: new Blob([id], { type: "video/mp4" })
  };
}

describe("project library initialization and CRUD", () => {
  beforeEach(async () => {
    await deleteDatabase(DB_NAME);
    await deleteDatabase(LEGACY_DB_NAME);
    const legacyDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(LEGACY_DB_NAME, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    legacyDatabase.close();
    await fetchLibrary("");
  });

  afterEach(async () => {
    await deleteDatabase(DB_NAME);
    await deleteDatabase(LEGACY_DB_NAME);
  });

  it("repairs invalid assignments and records a versioned marker", async () => {
    await seedStore(PROJECT_STORE_NAME, [
      {
        id: "p1",
        name: "Film",
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z"
      }
    ]);
    await seedStore(PROJECT_FOLDER_STORE_NAME, [
      {
        id: "f1",
        projectId: "p1",
        name: "Finals",
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z"
      }
    ]);
    await seedStore(LIBRARY_CLIP_STORE, [
      rawClip("missing-project", "missing", "f1"),
      rawClip("missing-folder", "p1", "missing"),
      rawClip("valid", "p1", "f1")
    ]);

    await initializeProjectLibrary();

    const clips = await fetchLibrary("");
    expect(
      clips
        .map(({ id, projectId, folderId }) => ({ id, projectId, folderId }))
        .sort((left, right) => left.id.localeCompare(right.id))
    ).toEqual([
      { id: "missing-folder", projectId: "p1", folderId: null },
      { id: "missing-project", projectId: null, folderId: null },
      { id: "valid", projectId: "p1", folderId: "f1" }
    ]);

    const marker = await withDatabaseStores(
      [LIBRARY_META_STORE_NAME],
      "readonly",
      (stores) => databaseRequest(stores[LIBRARY_META_STORE_NAME].get("project-library-schema"))
    );
    expect(marker).toEqual({ id: "project-library-schema", version: 1 });
  });

  it("is idempotent after the migration marker is written", async () => {
    await seedStore(LIBRARY_CLIP_STORE, [rawClip("quick", null, null)]);
    await initializeProjectLibrary();
    const first = await fetchLibrary("");

    await initializeProjectLibrary();
    const second = await fetchLibrary("");

    expect(second.map(({ id, updatedAt }) => ({ id, updatedAt }))).toEqual(
      first.map(({ id, updatedAt }) => ({ id, updatedAt }))
    );
  });

  it("creates a blank project or an optional starter structure", async () => {
    const blank = await createProject({ name: "  Film One  " });
    const templated = await createProject({
      name: "Film Two",
      useStarterFolders: true
    });

    expect(blank.project.name).toBe("Film One");
    expect(blank.folders).toEqual([]);
    expect(templated.folders.map(({ name }) => name)).toEqual([
      "Character A",
      "Character B",
      "Scene 01",
      "Pickups",
      "Finals"
    ]);
  });

  it("creates and renames projects and folders with scoped validation", async () => {
    const first = await createProject({ name: "First Film" });
    const second = await createProject({ name: "Second Film" });
    const folder = await createProjectFolder(first.project.id, "Finals");
    const sameNameElsewhere = await createProjectFolder(second.project.id, "Finals");

    expect(sameNameElsewhere.name).toBe("Finals");
    await expect(createProject({ name: " first film " })).rejects.toThrow(
      "already in use"
    );
    await expect(
      createProjectFolder(first.project.id, " finals ")
    ).rejects.toThrow("already in use");

    expect((await renameProject(first.project.id, "New title")).name).toBe(
      "New title"
    );
    expect((await renameProjectFolder(folder.id, "Pickups")).name).toBe(
      "Pickups"
    );
  });

  it("lists projects and folders in creation order", async () => {
    await seedStore(PROJECT_STORE_NAME, [
      {
        id: "later",
        name: "Later",
        createdAt: "2026-07-10T02:00:00.000Z",
        updatedAt: "2026-07-10T02:00:00.000Z"
      },
      {
        id: "earlier",
        name: "Earlier",
        createdAt: "2026-07-10T01:00:00.000Z",
        updatedAt: "2026-07-10T01:00:00.000Z"
      }
    ]);
    await seedStore(PROJECT_FOLDER_STORE_NAME, [
      {
        id: "f2",
        projectId: "earlier",
        name: "Second",
        createdAt: "2026-07-10T01:02:00.000Z",
        updatedAt: "2026-07-10T01:02:00.000Z"
      },
      {
        id: "f1",
        projectId: "earlier",
        name: "First",
        createdAt: "2026-07-10T01:01:00.000Z",
        updatedAt: "2026-07-10T01:01:00.000Z"
      }
    ]);

    expect((await fetchProjects()).map(({ name }) => name)).toEqual([
      "Earlier",
      "Later"
    ]);
    expect((await fetchProjectFolders()).map(({ name }) => name)).toEqual([
      "First",
      "Second"
    ]);
  });
});
