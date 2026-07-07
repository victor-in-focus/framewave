export interface ProcessCallbacks {
  onProgress?: (progress: number) => void;
  onStatus?: (status: string) => void;
}

/**
 * An enhancement transforms the trimmed audio before it is encoded into the
 * blank reference video. Optional future enhancements (e.g. voice isolation,
 * noise cleanup) plug in here without touching the engine or the UI flow.
 * Input and output are WAV audio blobs.
 */
export interface AudioEnhancement {
  name: string;
  apply(audio: Blob, callbacks?: ProcessCallbacks): Promise<Blob>;
}

export interface ExportClipOptions extends ProcessCallbacks {
  startTime: number;
  duration: number;
  enhancements?: AudioEnhancement[];
}

/**
 * A session holds one source file open so batch exports don't re-transfer
 * the source for every clip.
 */
export interface ProcessingSession {
  exportClip(options: ExportClipOptions): Promise<Blob>;
  dispose(): Promise<void>;
}

/**
 * The engine boundary. The default implementation runs FFmpeg compiled to
 * WebAssembly in the browser; a cloud-backed engine can implement the same
 * interface later without UI changes.
 */
export interface ProcessingEngine {
  openSource(sourceFile: File): Promise<ProcessingSession>;
}
