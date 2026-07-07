const OUTPUT_ENCODING_ARGS = [
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-tune",
  "stillimage",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-shortest",
  "-movflags",
  "+faststart"
];

function formatSeconds(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return safe.toFixed(3);
}

export function blackSourceArg(): string {
  return "color=black:size=1280x720:rate=30";
}

/**
 * Single pass: trim the source audio and mux it with a generated black
 * video track into an MP4.
 */
export function buildBlankClipArgs(
  inputName: string,
  outputName: string,
  startTime: number,
  duration: number
): string[] {
  const time = formatSeconds(duration);
  return [
    "-ss",
    formatSeconds(startTime),
    "-t",
    time,
    "-i",
    inputName,
    "-f",
    "lavfi",
    "-t",
    time,
    "-i",
    blackSourceArg(),
    "-map",
    "1:v",
    "-map",
    "0:a:0",
    ...OUTPUT_ENCODING_ARGS,
    outputName
  ];
}

/**
 * Enhancement path, step 1: extract the trimmed audio as WAV so
 * enhancements can transform it.
 */
export function buildExtractAudioArgs(
  inputName: string,
  outputName: string,
  startTime: number,
  duration: number
): string[] {
  return [
    "-ss",
    formatSeconds(startTime),
    "-t",
    formatSeconds(duration),
    "-i",
    inputName,
    "-vn",
    "-c:a",
    "pcm_s16le",
    "-f",
    "wav",
    outputName
  ];
}

/**
 * Enhancement path, step 2: encode the (possibly enhanced) WAV audio with
 * a generated black video track.
 */
export function buildEncodeAudioArgs(
  audioName: string,
  outputName: string,
  duration: number
): string[] {
  const time = formatSeconds(duration);
  return [
    "-t",
    time,
    "-i",
    audioName,
    "-f",
    "lavfi",
    "-t",
    time,
    "-i",
    blackSourceArg(),
    "-map",
    "1:v",
    "-map",
    "0:a:0",
    ...OUTPUT_ENCODING_ARGS,
    outputName
  ];
}

const NO_AUDIO_PATTERNS = [
  /matches no streams/i,
  /does not contain any stream/i,
  /output file .* does not contain any stream/i
];

export function describeExportFailure(logLines: string[]): string {
  const logText = logLines.join("\n");
  if (NO_AUDIO_PATTERNS.some((pattern) => pattern.test(logText))) {
    return "This file does not seem to have an audio track.";
  }

  const lastLine = logLines
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  return lastLine
    ? `Local processing failed: ${lastLine}`
    : "Local processing failed.";
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-m4a": "m4a",
  "audio/x-wav": "wav"
};

export function inputFilenameFor(file: Pick<File, "name" | "type">): string {
  const extensionMatch = /\.([a-z0-9]+)$/i.exec(file.name.trim());
  const extension =
    extensionMatch?.[1].toLowerCase() ??
    EXTENSION_BY_MIME[file.type.toLowerCase()] ??
    "mp4";
  return `input.${extension}`;
}
