import {
  databaseRequest,
  withDatabaseStore,
  type BatchClipDraft
} from "./libraryApi";

const SESSION_STORE = "session";
const SOURCE_KEY = "current-source";
const STATE_KEY = "current-state";

interface StoredSource {
  id: typeof SOURCE_KEY;
  file: File;
  updatedAt: string;
}

interface StoredState {
  id: typeof STATE_KEY;
  sourceName: string;
  startTime: number;
  endTime: number;
  batchClips: BatchClipDraft[];
  updatedAt: string;
}

export interface WorkSession {
  file: File;
  startTime: number;
  endTime: number;
  batchClips: BatchClipDraft[];
  updatedAt: string;
}

/**
 * The source file is written only when it changes; the light state
 * (trim range, batch draft) is written on edit. Both live in the same
 * IndexedDB store as the library so one database holds everything.
 */
export async function saveSessionSource(file: File): Promise<void> {
  const record: StoredSource = {
    id: SOURCE_KEY,
    file,
    updatedAt: new Date().toISOString()
  };
  await withDatabaseStore(SESSION_STORE, "readwrite", async (store) => {
    await databaseRequest(store.put(record));
  });
}

export async function saveSessionState(state: {
  sourceName: string;
  startTime: number;
  endTime: number;
  batchClips: BatchClipDraft[];
}): Promise<void> {
  const record: StoredState = {
    id: STATE_KEY,
    ...state,
    batchClips: state.batchClips.map((clip) => ({ ...clip })),
    updatedAt: new Date().toISOString()
  };
  await withDatabaseStore(SESSION_STORE, "readwrite", async (store) => {
    await databaseRequest(store.put(record));
  });
}

export async function loadWorkSession(): Promise<WorkSession | null> {
  try {
    const [source, state] = await withDatabaseStore(
      SESSION_STORE,
      "readonly",
      async (store) => {
        const storedSource = await databaseRequest(
          store.get(SOURCE_KEY) as IDBRequest<StoredSource | undefined>
        );
        const storedState = await databaseRequest(
          store.get(STATE_KEY) as IDBRequest<StoredState | undefined>
        );
        return [storedSource, storedState] as const;
      }
    );

    if (!source?.file) {
      return null;
    }

    const stateMatchesSource = state?.sourceName === source.file.name;
    return {
      file: source.file,
      startTime: stateMatchesSource ? state.startTime : 0,
      endTime: stateMatchesSource ? state.endTime : 0,
      batchClips: stateMatchesSource ? state.batchClips : [],
      updatedAt: state?.updatedAt ?? source.updatedAt
    };
  } catch {
    return null;
  }
}

export async function clearWorkSession(): Promise<void> {
  try {
    await withDatabaseStore(SESSION_STORE, "readwrite", async (store) => {
      await databaseRequest(store.delete(SOURCE_KEY));
      await databaseRequest(store.delete(STATE_KEY));
    });
  } catch {
    // A failed clear only means the resume offer reappears next visit.
  }
}
