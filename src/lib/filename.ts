export interface ReferenceFilenameOptions {
  characterName: string;
  descriptor: string;
  durationSeconds: number;
  separator?: "_" | "-";
  includeDuration?: boolean;
}

export function slugifyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function buildReferenceFilename(
  options: ReferenceFilenameOptions
): string {
  const separator = options.separator === "-" ? "-" : "_";
  const includeDuration = options.includeDuration ?? true;
  const nameParts = [
    slugifyPart(options.characterName),
    slugifyPart(options.descriptor)
  ].filter(Boolean);
  const duration = Number.isFinite(options.durationSeconds)
    ? Math.max(0, Math.round(options.durationSeconds))
    : null;
  const parts = nameParts.length > 0 ? nameParts : ["voice", "reference"];

  if (includeDuration && duration && duration > 0) {
    parts.push(`${duration}s`);
  }

  return `${parts.join(separator).replace(/_/g, separator)}.mp4`;
}
