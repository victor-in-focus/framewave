import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = new URL("../../", import.meta.url).pathname;
const ignoredDirs = new Set([".git", ".superpowers", "dist", "library", "node_modules"]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".json",
  ".md",
  ".svg",
  ".ts",
  ".tsx"
]);
const oldPascalName = ["Voice", "Blank"].join("");
const oldPackageName = ["voice", "blank"].join("");

function projectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (ignoredDirs.has(entry)) {
      return [];
    }

    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      return projectFiles(path);
    }
    if (!stats.isFile()) {
      return [];
    }
    if (![...textExtensions].some((extension) => path.endsWith(extension))) {
      return [];
    }

    return [path];
  });
}

describe("FrameWave branding", () => {
  it("uses the FrameWave name across project text files", () => {
    const filesWithOldName = projectFiles(repoRoot)
      .filter((path) => {
        const text = readFileSync(path, "utf8");
        return text.includes(oldPascalName) || text.includes(oldPackageName);
      })
      .map((path) => relative(repoRoot, path));

    expect(filesWithOldName).toEqual([]);

    expect(readFileSync(join(repoRoot, "src/App.tsx"), "utf8")).toContain(
      "FrameWave"
    );
    expect(readFileSync(join(repoRoot, "package.json"), "utf8")).toContain(
      '"name": "framewave"'
    );
  });
});
