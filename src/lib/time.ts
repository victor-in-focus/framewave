function safeSeconds(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

export function formatClockTime(seconds: number): string {
  const safe = safeSeconds(seconds);
  const minutes = Math.floor(safe / 60);
  const remaining = safe - minutes * 60;
  const wholeSeconds = Math.floor(remaining);
  const tenths = Math.floor((remaining - wholeSeconds) * 10);

  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(
    2,
    "0"
  )}.${tenths}`;
}

export function formatDuration(seconds: number): string {
  return `${safeSeconds(seconds).toFixed(1)}s`;
}
