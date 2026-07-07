import JSZip from "jszip";
import { getProcessingEngine } from "./processing";

export interface LibraryClip {
  id: string;
  sourceId: string | null;
  exportRunId: string | null;
  filename: string;
  title: string;
  descriptor: string;
  startTime: number;
  endTime: number;
  duration: number;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  mediaUrl: string;
  downloadUrl: string;
  thumbnailUrl: string | null;
}

export interface BatchClipDraft {
  id: string;
  title: string;
  characterName?: string;
  descriptor: string;
  start: number;
  end: number;
  outputName: string;
  tags: string[];
}

export interface LibraryJobClip {
  index: number;
  filename: string;
  status: "queued" | "processing" | "done" | "failed";
  error?: string | null;
  clipId?: string;
  downloadUrl?: string;
}

export interface LibraryJob {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  clips: LibraryJobClip[];
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string;
  error?: string;
}

export interface SaveLibraryClipInput {
  blob: Blob;
  filename: string;
  title: string;
  sourceName?: string | null;
  descriptor?: string;
  startTime?: number;
  endTime?: number;
  duration?: number;
  tags?: string[];
  favorite?: boolean;
  thumbnailBlob?: Blob | null;
  thumbnailName?: string;
}

interface StoredLibraryClip
  extends Omit<LibraryClip, "mediaUrl" | "downloadUrl" | "thumbnailUrl"> {
  blob: Blob;
  thumbnailBlob?: Blob | null;
  thumbnailName?: string;
  thumbnailUpdatedAt?: string | null;
}

const DB_NAME = "FrameWaveLibraryDB";
const LEGACY_DB_NAME = ["Voice", "Blank", "LibraryDB"].join("");
const DB_VERSION = 3;
const STORE_NAME = "clips";
const SESSION_STORE_NAME = "session";
const THUMBNAIL_MAX_SIZE = 768;
const THUMBNAIL_QUALITY = 0.84;

const objectUrls = new Map<string, { updatedAt: string; url: string }>();
const thumbnailUrls = new Map<string, { updatedAt: string; url: string }>();
let legacyMigrationPromise: Promise<void> | null = null;

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function normalizeTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
}

function normalizeTags(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of values ?? []) {
    const tag = normalizeTag(value);
    if (tag && !seen.has(tag)) {
      tags.push(tag);
      seen.add(tag);
    }
  }

  return tags;
}

function filenameStem(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function ensureMediaFilename(filename: string): string {
  const safe = filename.trim() || "voice_reference.mp4";
  return /\.(mp4|mov|webm)$/i.test(safe) ? safe : `${filenameStem(safe)}.mp4`;
}

export function parseTagInput(value: string): string[] {
  return normalizeTags(value.split(","));
}

export function isSupportedThumbnailFile(
  file: Pick<File, "name" | "type">
): boolean {
  const type = file.type.toLowerCase();
  return (
    ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type) ||
    /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  );
}

export function buildBatchClipPayload(clips: BatchClipDraft[]) {
  return clips.map((clip) => ({
    title: clip.title,
    descriptor: clip.descriptor,
    start: clip.start,
    end: clip.end,
    outputName: clip.outputName,
    tags: clip.tags
  }));
}

function openLibraryDb(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(
      new Error("This browser does not support the local library database.")
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("favorite", "favorite");
        store.createIndex("title", "title");
      }
      if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        db.createObjectStore(SESSION_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      migrateLegacyLibraryDb(request.result).finally(() => resolve(request.result));
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the local library."));
  });
}

function migrateLegacyLibraryDb(targetDb: IDBDatabase): Promise<void> {
  legacyMigrationPromise ??= copyLegacyLibraryDb(targetDb).catch(() => undefined);
  return legacyMigrationPromise;
}

async function copyLegacyLibraryDb(targetDb: IDBDatabase): Promise<void> {
  const targetHasRecords = (
    await Promise.all([
      storeHasRecords(targetDb, STORE_NAME),
      storeHasRecords(targetDb, SESSION_STORE_NAME)
    ])
  ).some(Boolean);

  if (targetHasRecords) {
    return;
  }

  const legacyDb = await openExistingLegacyLibraryDb();
  if (!legacyDb) {
    return;
  }

  try {
    const storeNames = [STORE_NAME, SESSION_STORE_NAME].filter(
      (storeName) =>
        targetDb.objectStoreNames.contains(storeName) &&
        legacyDb.objectStoreNames.contains(storeName)
    );
    const recordsByStore = await Promise.all(
      storeNames.map(
        async (storeName) =>
          [storeName, await readStoreRecords(legacyDb, storeName)] as const
      )
    );
    const storesWithRecords = recordsByStore.filter(
      ([, records]) => records.length > 0
    );

    if (storesWithRecords.length === 0) {
      return;
    }

    const transaction = targetDb.transaction(
      storesWithRecords.map(([storeName]) => storeName),
      "readwrite"
    );
    const done = transactionDone(transaction);

    await Promise.all(
      storesWithRecords.flatMap(([storeName, records]) =>
        records.map((record) =>
          requestToPromise(transaction.objectStore(storeName).put(record))
        )
      )
    );
    await done;
  } finally {
    legacyDb.close();
  }
}

function openExistingLegacyLibraryDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME);

    request.onupgradeneeded = () => {
      request.transaction?.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      if (request.error?.name === "AbortError") {
        resolve(null);
        return;
      }
      reject(request.error ?? new Error("Could not open the old local library."));
    };
  });
}

async function storeHasRecords(
  db: IDBDatabase,
  storeName: string
): Promise<boolean> {
  if (!db.objectStoreNames.contains(storeName)) {
    return false;
  }

  const transaction = db.transaction(storeName, "readonly");
  const done = transactionDone(transaction);
  const count = await requestToPromise(transaction.objectStore(storeName).count());
  await done;
  return count > 0;
}

async function readStoreRecords(
  db: IDBDatabase,
  storeName: string
): Promise<unknown[]> {
  const transaction = db.transaction(storeName, "readonly");
  const done = transactionDone(transaction);
  const records = await requestToPromise(transaction.objectStore(storeName).getAll());
  await done;
  return records;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local library request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Local library write failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local library write was cancelled."));
  });
}

export async function withDatabaseStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openLibraryDb();
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);

  try {
    const result = await action(store);
    await transactionDone(transaction);
    return result;
  } finally {
    db.close();
  }
}

export function databaseRequest<T>(request: IDBRequest<T>): Promise<T> {
  return requestToPromise(request);
}

function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  return withDatabaseStore(STORE_NAME, mode, action);
}

function mediaUrlFor(record: StoredLibraryClip): string {
  const existing = objectUrls.get(record.id);
  if (existing?.updatedAt === record.updatedAt) {
    return existing.url;
  }

  if (existing) {
    URL.revokeObjectURL(existing.url);
  }

  const url = URL.createObjectURL(record.blob);
  objectUrls.set(record.id, { updatedAt: record.updatedAt, url });
  return url;
}

function thumbnailUrlFor(record: StoredLibraryClip): string | null {
  if (!record.thumbnailBlob) {
    const existing = thumbnailUrls.get(record.id);
    if (existing) {
      URL.revokeObjectURL(existing.url);
      thumbnailUrls.delete(record.id);
    }
    return null;
  }

  const version = record.thumbnailUpdatedAt ?? record.updatedAt;
  const existing = thumbnailUrls.get(record.id);
  if (existing?.updatedAt === version) {
    return existing.url;
  }

  if (existing) {
    URL.revokeObjectURL(existing.url);
  }

  const url = URL.createObjectURL(record.thumbnailBlob);
  thumbnailUrls.set(record.id, { updatedAt: version, url });
  return url;
}

function revokeClipUrl(clipId: string): void {
  const existing = objectUrls.get(clipId);
  if (existing) {
    URL.revokeObjectURL(existing.url);
    objectUrls.delete(clipId);
  }

  const existingThumbnail = thumbnailUrls.get(clipId);
  if (existingThumbnail) {
    URL.revokeObjectURL(existingThumbnail.url);
    thumbnailUrls.delete(clipId);
  }
}

function toLibraryClip(record: StoredLibraryClip): LibraryClip {
  const url = mediaUrlFor(record);
  return {
    id: record.id,
    sourceId: record.sourceId,
    exportRunId: record.exportRunId,
    filename: record.filename,
    title: record.title,
    descriptor: record.descriptor,
    startTime: record.startTime,
    endTime: record.endTime,
    duration: record.duration,
    favorite: record.favorite,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    tags: record.tags,
    mediaUrl: url,
    downloadUrl: url,
    thumbnailUrl: thumbnailUrlFor(record)
  };
}

function clipMatchesQuery(record: StoredLibraryClip, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    record.title,
    record.filename,
    record.descriptor,
    ...record.tags
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function isSupportedReferenceFile(file: File): boolean {
  return (
    file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name)
  );
}

async function readMediaDuration(blob: Blob): Promise<number> {
  if (typeof document === "undefined") {
    return 0;
  }

  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");

  try {
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read media duration."));
      video.load();
    });

    return Number.isFinite(video.duration) ? video.duration : 0;
  } catch {
    return 0;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read this image."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressThumbnail(file: File): Promise<Blob> {
  if (!isSupportedThumbnailFile(file)) {
    throw new Error("Use a JPG, PNG, WEBP, or GIF image for thumbnails.");
  }

  if (typeof document === "undefined") {
    return file;
  }

  const image = await readImage(file);
  const scale = Math.min(
    1,
    THUMBNAIL_MAX_SIZE / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      "image/jpeg",
      THUMBNAIL_QUALITY
    );
  });
}

export async function saveLibraryClip(
  input: SaveLibraryClipInput
): Promise<LibraryClip> {
  const now = new Date().toISOString();
  const duration = input.duration ?? 0;
  const startTime = input.startTime ?? 0;
  const endTime = input.endTime ?? startTime + duration;
  const filename = ensureMediaFilename(input.filename);

  const record: StoredLibraryClip = {
    id: createId(),
    sourceId: input.sourceName?.trim() || null,
    exportRunId: null,
    filename,
    title: input.title.trim() || filenameStem(filename),
    descriptor: input.descriptor?.trim() ?? "",
    startTime,
    endTime,
    duration,
    favorite: input.favorite ?? false,
    createdAt: now,
    updatedAt: now,
    tags: normalizeTags(input.tags),
    thumbnailBlob: input.thumbnailBlob ?? null,
    thumbnailName: input.thumbnailName,
    thumbnailUpdatedAt: input.thumbnailBlob ? now : null,
    blob: input.blob
  };

  await withStore("readwrite", async (store) => {
    await requestToPromise(store.put(record));
  });

  return toLibraryClip(record);
}

export async function fetchLibrary(
  query: string,
  favoritesOnly = false
): Promise<LibraryClip[]> {
  const records = await withStore("readonly", (store) =>
    requestToPromise(store.getAll() as IDBRequest<StoredLibraryClip[]>)
  );

  return records
    .filter((record) => !favoritesOnly || record.favorite)
    .filter((record) => clipMatchesQuery(record, query))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toLibraryClip);
}

export async function updateLibraryClip(
  clipId: string,
  updates: Partial<Pick<LibraryClip, "title" | "descriptor" | "favorite" | "tags">>
): Promise<LibraryClip> {
  const updated = await withStore("readwrite", async (store) => {
    const record = await requestToPromise(
      store.get(clipId) as IDBRequest<StoredLibraryClip | undefined>
    );

    if (!record) {
      throw new Error("Library clip was not found.");
    }

    const nextRecord: StoredLibraryClip = {
      ...record,
      title:
        typeof updates.title === "string" && updates.title.trim()
          ? updates.title.trim()
          : record.title,
      descriptor:
        typeof updates.descriptor === "string"
          ? updates.descriptor.trim()
          : record.descriptor,
      favorite:
        typeof updates.favorite === "boolean"
          ? updates.favorite
          : record.favorite,
      tags: Array.isArray(updates.tags)
        ? normalizeTags(updates.tags)
        : record.tags,
      updatedAt: new Date().toISOString()
    };

    await requestToPromise(store.put(nextRecord));
    return nextRecord;
  });

  return toLibraryClip(updated);
}

export async function updateLibraryClipThumbnail(
  clipId: string,
  file: File | null
): Promise<LibraryClip> {
  const thumbnailBlob = file ? await compressThumbnail(file) : null;

  const updated = await withStore("readwrite", async (store) => {
    const record = await requestToPromise(
      store.get(clipId) as IDBRequest<StoredLibraryClip | undefined>
    );

    if (!record) {
      throw new Error("Library clip was not found.");
    }

    const now = new Date().toISOString();
    const nextRecord: StoredLibraryClip = {
      ...record,
      thumbnailBlob,
      thumbnailName: file?.name,
      thumbnailUpdatedAt: thumbnailBlob ? now : null,
      updatedAt: now
    };

    await requestToPromise(store.put(nextRecord));
    return nextRecord;
  });

  return toLibraryClip(updated);
}

export async function deleteLibraryClip(clipId: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.delete(clipId));
  });
  revokeClipUrl(clipId);
}

export async function importLibraryClip(
  file: File,
  tags: string[],
  title?: string
): Promise<LibraryClip> {
  if (!isSupportedReferenceFile(file)) {
    throw new Error("Import an MP4, MOV, or WEBM reference file.");
  }

  const duration = await readMediaDuration(file);
  return saveLibraryClip({
    blob: file,
    filename: file.name,
    title: title || filenameStem(file.name),
    tags,
    duration,
    endTime: duration
  });
}

export async function startBatchExport(
  sourceFile: File,
  clips: BatchClipDraft[],
  onUpdate?: (job: LibraryJob) => void,
  thumbnails?: (Blob | null)[]
): Promise<LibraryJob> {
  const createdAt = new Date().toISOString();
  const jobClips: LibraryJobClip[] = clips.map((clip, index) => ({
    index,
    filename: clip.outputName,
    status: "queued"
  }));

  const job: LibraryJob = {
    id: createId(),
    status: "processing",
    progress: 0,
    clips: jobClips,
    createdAt,
    updatedAt: createdAt
  };

  const emit = () => {
    onUpdate?.({
      ...job,
      updatedAt: new Date().toISOString(),
      clips: jobClips.map((clip) => ({ ...clip }))
    });
  };

  emit();

  const zip = new JSZip();
  const zipNames = new Set<string>();
  const reserveZipName = (filename: string): string => {
    let name = filename;
    let attempt = 2;
    while (zipNames.has(name)) {
      name = `${filenameStem(filename)}_${String(attempt).padStart(2, "0")}.mp4`;
      attempt += 1;
    }
    zipNames.add(name);
    return name;
  };
  const session = await getProcessingEngine().openSource(sourceFile);

  try {
    for (const [index, clip] of clips.entries()) {
      jobClips[index] = { ...jobClips[index], status: "processing" };
      emit();

      try {
        const clipBlob = await session.exportClip({
          startTime: clip.start,
          duration: Math.max(0, clip.end - clip.start),
          onProgress: (clipProgress) => {
            job.progress = (index + clipProgress) / clips.length;
            emit();
          }
        });

        const saved = await saveLibraryClip({
          blob: clipBlob,
          filename: clip.outputName,
          title: clip.title || filenameStem(clip.outputName),
          sourceName: sourceFile.name,
          descriptor: clip.descriptor,
          tags: clip.tags,
          startTime: clip.start,
          endTime: clip.end,
          duration: clip.end - clip.start,
          thumbnailBlob: thumbnails?.[index] ?? null
        });

        zip.file(reserveZipName(saved.filename), clipBlob);
        jobClips[index] = {
          index,
          filename: saved.filename,
          status: "done",
          clipId: saved.id,
          downloadUrl: saved.downloadUrl
        };
      } catch (clipError) {
        jobClips[index] = {
          ...jobClips[index],
          status: "failed",
          error:
            clipError instanceof Error
              ? clipError.message
              : "This clip could not be exported."
        };
      }

      job.progress = (index + 1) / clips.length;
      emit();
    }
  } finally {
    await session.dispose();
  }

  const doneClips = jobClips.filter((clip) => clip.status === "done");
  const failed = doneClips.length < clips.length;

  if (doneClips.length > 0) {
    const zipBlob = await zip.generateAsync({ type: "blob" });
    job.downloadUrl = URL.createObjectURL(zipBlob);
  }

  job.status = failed ? "failed" : "done";
  job.progress = 1;
  job.updatedAt = new Date().toISOString();
  job.error = failed ? "Some clips could not be exported." : undefined;
  emit();
  return {
    ...job,
    clips: jobClips.map((clip) => ({ ...clip }))
  };
}

export async function exportLibraryArchive(): Promise<Blob> {
  const records = await withStore("readonly", (store) =>
    requestToPromise(store.getAll() as IDBRequest<StoredLibraryClip[]>)
  );

  if (records.length === 0) {
    throw new Error("The library is empty - nothing to export yet.");
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const record of records) {
    let name = ensureMediaFilename(record.filename);
    let attempt = 2;
    while (usedNames.has(name)) {
      name = `${filenameStem(record.filename)}_${String(attempt).padStart(2, "0")}.mp4`;
      attempt += 1;
    }
    usedNames.add(name);
    zip.file(name, record.blob);
  }

  return zip.generateAsync({ type: "blob" });
}
