import { wasmProcessingEngine } from "./wasmEngine";
import type { ProcessCallbacks, ProcessingEngine } from "./types";

export type {
  AudioEnhancement,
  ExportClipOptions,
  ProcessingEngine,
  ProcessingSession
} from "./types";

export function getProcessingEngine(): ProcessingEngine {
  return wasmProcessingEngine;
}

export interface CreateBlankVoiceReferenceOptions extends ProcessCallbacks {
  sourceFile: File;
  startTime: number;
  duration: number;
}

export async function createBlankVoiceReference({
  sourceFile,
  startTime,
  duration,
  onProgress,
  onStatus
}: CreateBlankVoiceReferenceOptions): Promise<Blob> {
  const session = await getProcessingEngine().openSource(sourceFile);
  try {
    return await session.exportClip({
      startTime,
      duration,
      onProgress,
      onStatus
    });
  } finally {
    await session.dispose();
  }
}
