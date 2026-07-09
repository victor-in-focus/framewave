import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fetchLibrary,
  saveLibraryClip,
  withDatabaseStores
} from "./libraryApi";

const DB_NAME = "FrameWaveLibraryDB";
const LEGACY_DB_NAME = ["Voice", "Blank", "LibraryDB"].join("");

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function deleteDatabase(name = DB_NAME): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openDatabase(
  version?: number,
  upgrade?: (database: IDBDatabase) => void
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe("project library schema", () => {
  beforeEach(async () => {
    await deleteDatabase();
    await deleteDatabase(LEGACY_DB_NAME);
    const legacyDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(LEGACY_DB_NAME, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    legacyDatabase.close();
  });
  afterEach(async () => {
    await deleteDatabase();
    await deleteDatabase(LEGACY_DB_NAME);
  });

  it("creates project stores without removing the clip and session stores", async () => {
    await fetchLibrary("");

    const database = await openDatabase();
    try {
      expect([...database.objectStoreNames]).toEqual([
        "clips",
        "library-meta",
        "project-folders",
        "projects",
        "session"
      ]);
    } finally {
      database.close();
    }
  });

  it("loads old clips and saves new clips with no project assignment", async () => {
    const oldDatabase = await openDatabase(3, (database) => {
      database.createObjectStore("clips", { keyPath: "id" });
      database.createObjectStore("session", { keyPath: "id" });
    });
    const transaction = oldDatabase.transaction("clips", "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore("clips").put({
      id: "old-clip",
      sourceId: null,
      exportRunId: null,
      filename: "old-clip.mp4",
      title: "Old clip",
      descriptor: "",
      startTime: 0,
      endTime: 2,
      duration: 2,
      favorite: false,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
      tags: [],
      blob: new Blob(["old"], { type: "video/mp4" })
    });
    await done;
    oldDatabase.close();

    const [oldClip] = await fetchLibrary("");
    expect(oldClip).toMatchObject({
      id: "old-clip",
      projectId: null,
      folderId: null
    });

    const newClip = await saveLibraryClip({
      blob: new Blob(["new"], { type: "video/mp4" }),
      filename: "new-clip.mp4",
      title: "New clip"
    });
    expect(newClip).toMatchObject({ projectId: null, folderId: null });
  });

  it("aborts every store write when a multi-store action fails", async () => {
    await fetchLibrary("");

    await expect(
      withDatabaseStores(
        ["projects", "library-meta"],
        "readwrite",
        async (stores) => {
          await requestResult(
            stores.projects.put({
              id: "p1",
              name: "Film",
              createdAt: "2026-07-10T00:00:00.000Z",
              updatedAt: "2026-07-10T00:00:00.000Z"
            })
          );
          await requestResult(
            stores["library-meta"].put({ id: "marker", version: 1 })
          );
          throw new Error("stop");
        }
      )
    ).rejects.toThrow("stop");

    const database = await openDatabase();
    try {
      const transaction = database.transaction(
        ["projects", "library-meta"],
        "readonly"
      );
      const projects = await requestResult(
        transaction.objectStore("projects").getAll()
      );
      const metadata = await requestResult(
        transaction.objectStore("library-meta").getAll()
      );
      expect(projects).toEqual([]);
      expect(metadata).toEqual([]);
    } finally {
      database.close();
    }
  });
});
