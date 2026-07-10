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
const formerCreatorName = ["Victor", "Banya"].join(" ");
const unwantedAssistantName = ["Clau", "de"].join("");
const unwantedVendorName = ["Anth", "ropic"].join("");
const extensionlessTextFiles = new Set([".gitignore", "LICENSE"]);

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
    if (
      !extensionlessTextFiles.has(entry) &&
      ![...textExtensions].some((extension) => path.endsWith(extension))
    ) {
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

  it("credits VictorInFocus without obsolete contributor attribution", () => {
    const filesWithObsoleteAttribution = projectFiles(repoRoot)
      .filter((path) => {
        const text = readFileSync(path, "utf8");
        return (
          text.includes(formerCreatorName) ||
          text.toLowerCase().includes(unwantedAssistantName.toLowerCase()) ||
          text.toLowerCase().includes(unwantedVendorName.toLowerCase())
        );
      })
      .map((path) => relative(repoRoot, path));

    expect(filesWithObsoleteAttribution).toEqual([]);
    expect(readFileSync(join(repoRoot, "src/lib/brand.ts"), "utf8")).toContain(
      "VictorInFocus"
    );
    expect(readFileSync(join(repoRoot, "README.md"), "utf8")).toContain(
      "VictorInFocus"
    );
    expect(readFileSync(join(repoRoot, "LICENSE"), "utf8")).toContain(
      "VictorInFocus"
    );
  });
});
