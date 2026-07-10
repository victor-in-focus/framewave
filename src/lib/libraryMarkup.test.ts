import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

function referenceRowSource(): string {
  const libraryStart = appSource.indexOf('className="library-list"');
  const start = appSource.indexOf("<article", libraryStart);
  const end = appSource.indexOf("</article>", start);

  return appSource.slice(start, end);
}

describe("library row markup", () => {
  it("places tags below the title and playback below the tags", () => {
    const rowSource = referenceRowSource();
    const titleIndex = rowSource.indexOf('className="library-title-row"');
    const tagsIndex = rowSource.indexOf('className="library-tags"');
    const playerIndex = rowSource.indexOf('className="library-row-meta"');

    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(tagsIndex).toBeGreaterThan(titleIndex);
    expect(playerIndex).toBeGreaterThan(tagsIndex);
  });

  it("shows the filename directly below the library title", () => {
    const rowSource = referenceRowSource();
    const titleIndex = rowSource.indexOf("<strong>{displayTitle}</strong>");
    const filenameIndex = rowSource.indexOf(
      '<p className="library-filename">'
    );
    const tagsIndex = rowSource.indexOf('className="library-tags"');

    expect(filenameIndex).toBeGreaterThan(titleIndex);
    expect(filenameIndex).toBeLessThan(tagsIndex);
  });

  it("does not render a standalone duration label before the library player", () => {
    expect(referenceRowSource()).not.toContain("formatDuration(clip.duration)");
  });

  it("renders top-right card action icons in reference rows", () => {
    const rowSource = referenceRowSource();

    expect(rowSource).toContain('className="library-actions"');
    expect(rowSource).toContain("<Star");
    expect(rowSource).toContain("<Download");
    expect(rowSource).toContain("<Tags");
    expect(rowSource).toContain("<FolderInput");
    expect(rowSource).toContain('aria-label={`Move reference: ${displayTitle}`}');
    expect(rowSource).toContain("<Trash2");
  });

  it("provides action-oriented tooltips for icon controls", () => {
    const rowSource = referenceRowSource();

    expect(rowSource).toContain("Replace thumbnail for");
    expect(rowSource).toContain("Remove thumbnail from");
    expect(rowSource).toContain("Remove from Starred");
    expect(rowSource).toContain("Add to Starred");
    expect(rowSource).toContain('title="Download reference MP4"');
    expect(rowSource).toContain('title="Edit tags"');
    expect(rowSource).toContain('title="Move to project or folder"');
    expect(rowSource).toContain('title="Delete reference"');
    expect(rowSource).toContain("Pause voice reference");
    expect(rowSource).toContain("Play voice reference");
  });
});
