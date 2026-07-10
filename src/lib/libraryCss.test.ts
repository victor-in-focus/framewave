import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");

function cssRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));
  return match?.[1] ?? "";
}

describe("library card CSS", () => {
  it("keeps audio playback as a local accent instead of repainting the whole card", () => {
    const playingRule = cssRule(".library-item.is-playing");

    expect(playingRule).not.toContain("background: var(--foreground)");
    expect(playingRule).not.toContain("color: var(--panel-foreground)");
  });

  it("uses larger media-led list cards with quiet top-right actions", () => {
    expect(cssRule(".library-item")).toContain(
      "grid-template-columns: minmax(82px, 96px) minmax(0, 1fr)"
    );
    expect(cssRule(".library-list")).toContain("gap: 6px");
    expect(cssRule(".library-item")).toContain(
      "border: 1px solid var(--border)"
    );
    expect(cssRule(".library-item")).toContain("border-radius: 6px");
    expect(cssRule(".library-item")).not.toContain("border-top: 1px solid");
    expect(cssRule(".library-title-row")).toContain(
      "grid-template-columns: minmax(0, 1fr) auto"
    );
    expect(css).toContain(".library-actions");
    expect(cssRule(".library-actions button")).toContain("border: 0");
    expect(cssRule(".library-actions button")).toContain("box-shadow: none");
    expect(cssRule(".library-actions button")).toContain("background: transparent");
  });

  it("keeps reference thumbnails visually unframed", () => {
    const thumbnailRule = cssRule(".library-thumbnail");

    expect(thumbnailRule).toContain("border: 0");
    expect(thumbnailRule).toContain("box-shadow: none");
  });

  it("uses a custom compact player instead of visible native audio chrome", () => {
    expect(cssRule(".library-player")).toContain("display: grid");
    expect(cssRule(".library-player")).toContain("border: 0");
    expect(cssRule(".library-player")).toContain("background: transparent");
    expect(cssRule(".library-player-button")).toContain("background: var(--foreground)");
    expect(cssRule(".library-audio")).toContain("display: none");
    expect(cssRule(".library-player-progress")).toContain("height: 4px");
  });

  it("left-aligns playback without a separate duration column", () => {
    const rowMetaRule = cssRule(".library-row-meta");

    expect(rowMetaRule).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(rowMetaRule).toContain("justify-items: start");
    expect(rowMetaRule).not.toContain("grid-template-columns: auto");
  });

  it("keeps utility controls available without competing with playback", () => {
    expect(cssRule(".library-search > span")).toContain("clip-path: inset(50%)");
    expect(cssRule(".library-import-toggle")).toContain("opacity: 1");
    expect(cssRule(".library-toolbar button.library-import-toggle")).toContain(
      "background: rgba(249, 248, 243, 0.7)"
    );
    expect(css).not.toContain(".library-actions-secondary");
  });

  it("does not keep removed navigation and view chrome styles", () => {
    expect(css).not.toContain(".app-tabs");
    expect(css).not.toContain(".library-view-toggle");
    expect(css).not.toContain(".library-filter-tabs");
    expect(css).not.toContain(".library-list.is-grid");
  });
});

describe("creator trim CSS", () => {
  it("visually attaches the trim strip to the video preview", () => {
    expect(cssRule(".source-row")).toContain("padding-bottom: 8px");
    expect(cssRule(".range-row")).toContain("border-top: 0");
    expect(cssRule(".range-row")).toContain("padding-top: 0");
    expect(cssRule(".range-row .row-meta")).toContain("display: none");
    expect(cssRule(".range-row .row-main")).toContain("grid-column: 1");
  });

  it("keeps the trim play action icon-sized", () => {
    const playRule = cssRule(".trim-play-pill");

    expect(playRule).toContain("width: 44px");
    expect(playRule).not.toContain("min-width: 82px");
  });

  it("keeps tiny trim selections easy to expand", () => {
    const selectionRule = cssRule(".trim-selection");
    const handleRule = cssRule(".trim-handle");
    const activeHandleRule = cssRule(".trim-handle:not(:disabled):active");

    expect(selectionRule).toContain("min-width: 56px");
    expect(handleRule).toContain("width: 44px");
    expect(handleRule).toContain("touch-action: none");
    expect(activeHandleRule).toContain("transform: none");
  });
});
