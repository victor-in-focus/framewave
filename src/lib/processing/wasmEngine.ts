import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import coreJsUrl from "@ffmpeg/core?url";
import coreWasmUrl from "@ffmpeg/core/wasm?url";
import {
  buildBlankClipArgs,
  buildEncodeAudioArgs,
  buildExtractAudioArgs,
  describeExportFailure,
  inputFilenameFor
} from "./ffmpegArgs";
import type {
  ExportClipOptions,
  ProcessCallbacks,
  ProcessingEngine,
  ProcessingSession
} from "./types";

const LOG_TAIL_LIMIT = 40;

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let execQueue: Promise<unknown> = Promise.resolve();

async function loadFFmpeg(onStatus?: (status: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (!loadPromise) {
    onStatus?.("Loading the local video engine...");
    const ffmpeg = new FFmpeg();
    loadPromise = ffmpeg
      .load({ coreURL: coreJsUrl, wasmURL: coreWasmUrl })
      .then(() => {
        ffmpegInstance = ffmpeg;
        return ffmpeg;
      })
      .catch((error) => {
        loadPromise = null;
        throw error instanceof Error
          ? error
          : new Error("Could not load the local video engine.");
      });
  }

  return loadPromise;
}

/** FFmpeg's wasm build handles one exec at a time; serialize all work. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = execQueue.then(task, task);
  execQueue = next.catch(() => undefined);
  return next;
}

async function execOrThrow(
  ffmpeg: FFmpeg,
  args: string[],
  onProgress?: (ratio: number) => void
): Promise<void> {
  const logTail: string[] = [];
  const handleLog = ({ message }: { message: string }) => {
    logTail.push(message);
    if (logTail.length > LOG_TAIL_LIMIT) {
      logTail.shift();
    }
  };
  const handleProgress = ({ progress }: { progress: number }) => {
    if (onProgress && Number.isFinite(progress)) {
      onProgress(Math.max(0, Math.min(1, progress)));
    }
  };

  ffmpeg.on("log", handleLog);
  ffmpeg.on("progress", handleProgress);
  try {
    const code = await ffmpeg.exec(args);
    if (code !== 0) {
      throw new Error(describeExportFailure(logTail));
    }
  } finally {
    ffmpeg.off("log", handleLog);
    ffmpeg.off("progress", handleProgress);
  }
}

async function deleteQuietly(ffmpeg: FFmpeg, filename: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(filename);
  } catch {
    // The file may not exist; nothing to clean up.
  }
}

function toBlob(data: Uint8Array | string, type: string): Blob {
  if (typeof data === "string") {
    throw new Error("Local processing produced unexpected text output.");
  }
  return new Blob([data.slice()], { type });
}

async function runEnhancements(
  ffmpeg: FFmpeg,
  options: ExportClipOptions,
  inputName: string,
  outputName: string,
  callbacks: ProcessCallbacks
): Promise<void> {
  const enhancements = options.enhancements ?? [];
  const rawAudioName = "trimmed_audio.wav";
  const enhancedAudioName = "enhanced_audio.wav";

  callbacks.onStatus?.("Extracting audio...");
  await execOrThrow(
    ffmpeg,
    buildExtractAudioArgs(inputName, rawAudioName, options.startTime, options.duration)
  );

  try {
    let audio = toBlob(await ffmpeg.readFile(rawAudioName), "audio/wav");
    for (const enhancement of enhancements) {
      callbacks.onStatus?.(`Applying ${enhancement.name}...`);
      audio = await enhancement.apply(audio, callbacks);
    }

    await ffmpeg.writeFile(enhancedAudioName, await fetchFile(audio));
    callbacks.onStatus?.("Encoding blank reference video...");
    await execOrThrow(
      ffmpeg,
      buildEncodeAudioArgs(enhancedAudioName, outputName, options.duration),
      (ratio) => callbacks.onProgress?.(0.4 + ratio * 0.55)
    );
  } finally {
    await deleteQuietly(ffmpeg, rawAudioName);
    await deleteQuietly(ffmpeg, enhancedAudioName);
  }
}

class WasmProcessingSession implements ProcessingSession {
  private inputName: string | null = null;
  private disposed = false;

  constructor(private readonly sourceFile: File) {}

  private async ensureInput(
    ffmpeg: FFmpeg,
    onStatus?: (status: string) => void
  ): Promise<string> {
    if (this.inputName) {
      return this.inputName;
    }

    onStatus?.("Reading source media...");
    const inputName = inputFilenameFor(this.sourceFile);
    await ffmpeg.writeFile(inputName, await fetchFile(this.sourceFile));
    this.inputName = inputName;
    return inputName;
  }

  exportClip(options: ExportClipOptions): Promise<Blob> {
    if (this.disposed) {
      return Promise.reject(new Error("This processing session is closed."));
    }

    return enqueue(async () => {
      const ffmpeg = await loadFFmpeg(options.onStatus);
      options.onProgress?.(0.05);
      const inputName = await this.ensureInput(ffmpeg, options.onStatus);
      options.onProgress?.(0.15);

      const outputName = "output.mp4";
      await deleteQuietly(ffmpeg, outputName);

      try {
        if (options.enhancements?.length) {
          await runEnhancements(ffmpeg, options, inputName, outputName, {
            onProgress: options.onProgress,
            onStatus: options.onStatus
          });
        } else {
          options.onStatus?.("Creating blank reference video...");
          await execOrThrow(
            ffmpeg,
            buildBlankClipArgs(
              inputName,
              outputName,
              options.startTime,
              options.duration
            ),
            (ratio) => options.onProgress?.(0.15 + ratio * 0.8)
          );
        }

        const output = toBlob(await ffmpeg.readFile(outputName), "video/mp4");
        options.onProgress?.(1);
        return output;
      } finally {
        await deleteQuietly(ffmpeg, outputName);
      }
    });
  }

  dispose(): Promise<void> {
    this.disposed = true;
    return enqueue(async () => {
      if (this.inputName && ffmpegInstance?.loaded) {
        await deleteQuietly(ffmpegInstance, this.inputName);
      }
      this.inputName = null;
    });
  }
}

export const wasmProcessingEngine: ProcessingEngine = {
  async openSource(sourceFile: File): Promise<ProcessingSession> {
    return new WasmProcessingSession(sourceFile);
  }
};
