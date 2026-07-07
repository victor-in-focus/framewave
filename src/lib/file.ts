const SUPPORTED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm"
]);

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-m4a",
  "audio/x-wav"
]);

const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];
const SUPPORTED_AUDIO_EXTENSIONS = [
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".wav"
];
const SUPPORTED_SOURCE_EXTENSIONS = [
  ...SUPPORTED_VIDEO_EXTENSIONS,
  ...SUPPORTED_AUDIO_EXTENSIONS
];

export type SourceFileKind = "video" | "audio" | "unsupported";

function matchesExtension(file: File, extensions: string[]): boolean {
  const lowerName = file.name.toLowerCase();
  return extensions.some((extension) => lowerName.endsWith(extension));
}

export function getSourceFileKind(file: File): SourceFileKind {
  if (
    SUPPORTED_VIDEO_MIME_TYPES.has(file.type) ||
    matchesExtension(file, SUPPORTED_VIDEO_EXTENSIONS)
  ) {
    return "video";
  }

  if (
    SUPPORTED_AUDIO_MIME_TYPES.has(file.type) ||
    matchesExtension(file, SUPPORTED_AUDIO_EXTENSIONS)
  ) {
    return "audio";
  }

  return "unsupported";
}

export function isSupportedSourceFile(file: File): boolean {
  if (
    SUPPORTED_VIDEO_MIME_TYPES.has(file.type) ||
    SUPPORTED_AUDIO_MIME_TYPES.has(file.type)
  ) {
    return true;
  }

  return matchesExtension(file, SUPPORTED_SOURCE_EXTENSIONS);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const megabytes = bytes / 1024 / 1024;
  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)} MB`;
  }

  const kilobytes = bytes / 1024;
  return `${Math.max(1, Math.round(kilobytes))} KB`;
}
