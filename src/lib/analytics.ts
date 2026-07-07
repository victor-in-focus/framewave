export type FunnelEvent =
  | "source_loaded"
  | "clip_exported"
  | "batch_exported";

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

/**
 * Privacy-friendly funnel counter. Reports event names only - never file
 * names, media content, or anything user-identifying. No-op unless a
 * Plausible-compatible script is present on the page, so local and
 * self-hosted installs track nothing.
 */
export function trackEvent(event: FunnelEvent): void {
  try {
    window.plausible?.(event);
  } catch {
    // Analytics must never break the app.
  }
}
