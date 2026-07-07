export interface RangeValidation {
  valid: boolean;
  message: string | null;
  duration: number;
}

function normalizeSeconds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundTenth(value: number): number {
  return Number(value.toFixed(1));
}

export function clampRange(start: number, end: number, mediaDuration: number) {
  const max = normalizeSeconds(mediaDuration);
  const boundedStart = Math.min(normalizeSeconds(start), max);
  const boundedEnd = Math.min(normalizeSeconds(end), max);
  const orderedStart = Math.min(boundedStart, boundedEnd);
  const orderedEnd = Math.max(boundedStart, boundedEnd);

  return { start: orderedStart, end: orderedEnd };
}

export function getRangeValidation(
  start: number,
  end: number,
  mediaDuration: number
): RangeValidation {
  const range = clampRange(start, end, mediaDuration);
  const duration = roundTenth(range.end - range.start);

  if (duration <= 0) {
    return {
      valid: false,
      message: "Select a range longer than 0 seconds.",
      duration
    };
  }

  return {
    valid: true,
    message: null,
    duration
  };
}
