export interface TrimSelection {
  start: number;
  end: number;
}

export type TrimEdge = "start" | "end";

const MIN_REFERENCE_SECONDS = 0.1;

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function roundTenth(value: number): number {
  return Number(value.toFixed(1));
}

export function secondsToPercent(seconds: number, mediaDuration: number): number {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) {
    return 0;
  }

  return roundTenth(clamp(seconds, 0, mediaDuration) / mediaDuration * 100);
}

export function percentToSeconds(percent: number, mediaDuration: number): number {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) {
    return 0;
  }

  return roundTenth(clamp(percent, 0, 100) / 100 * mediaDuration);
}

export function resizeTrimEdge(
  edge: TrimEdge,
  nextSeconds: number,
  selection: TrimSelection,
  mediaDuration: number,
  maxDuration = Number.POSITIVE_INFINITY
): TrimSelection {
  const duration = Math.max(0, mediaDuration);

  if (edge === "start") {
    const latestStart = Math.max(
      0,
      selection.end - Math.min(maxDuration, selection.end)
    );
    const start = clamp(
      nextSeconds,
      latestStart,
      Math.max(0, selection.end - MIN_REFERENCE_SECONDS)
    );

    return {
      start: roundTenth(start),
      end: roundTenth(selection.end)
    };
  }

  const earliestEnd = selection.start + MIN_REFERENCE_SECONDS;
  const latestEnd = Math.min(duration, selection.start + maxDuration);
  const end = clamp(nextSeconds, earliestEnd, latestEnd);

  return {
    start: roundTenth(selection.start),
    end: roundTenth(end)
  };
}

export function moveTrimSelection(
  nextStart: number,
  selection: TrimSelection,
  mediaDuration: number
): TrimSelection {
  const selectedDuration = Math.max(0, selection.end - selection.start);
  const safeDuration = Math.min(selectedDuration, Math.max(0, mediaDuration));
  const start = clamp(nextStart, 0, Math.max(0, mediaDuration - safeDuration));

  return {
    start: roundTenth(start),
    end: roundTenth(start + safeDuration)
  };
}

export function buildThumbnailTimes(
  mediaDuration: number,
  frameCount: number
): number[] {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0 || frameCount <= 0) {
    return [];
  }

  if (frameCount === 1) {
    return [0];
  }

  const lastSample = Math.max(0, mediaDuration - 0.1);
  return Array.from({ length: frameCount }, (_, index) =>
    roundTenth(
      index === frameCount - 1
        ? lastSample
        : (mediaDuration / (frameCount - 1)) * index
    )
  );
}
