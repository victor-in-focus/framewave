import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appCss = readFileSync(new URL("../App.css", import.meta.url), "utf8");
const indexCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");

function cssRule(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));
  return match?.[1] ?? "";
}

function lastCssRule(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = Array.from(
    source.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`, "g"))
  );
  return matches.at(-1)?.[1] ?? "";
}

describe("professional workspace visual contract", () => {
  it("uses the aurora token system: violet accent on deep indigo surfaces", () => {
    const root = cssRule(indexCss, ":root");

    expect(root).toContain("--background: #08090f");
    expect(root).toContain("--surface-1: #0f1018");
    expect(root).toContain("--surface-2: #161726");
    expect(root).toContain("--accent: #8b7cf7");
    expect(root).toContain("--accent-soft: rgba(139, 124, 247, 0.16)");
    expect(root).toContain("--gold: #f2c94c");
    expect(root).toContain("--status-good: #35d67f");
  });

  it("reserves stable expanded and collapsed sidebar columns", () => {
    expect(cssRule(appCss, ".app-shell")).toContain(
      "grid-template-columns: 232px minmax(0, 1fr)"
    );
    expect(cssRule(appCss, ".app-shell.is-sidebar-collapsed")).toContain(
      "grid-template-columns: 56px minmax(0, 1fr)"
    );
  });

  it("uses soft glass workspace surfaces with a shared radius", () => {
    expect(cssRule(appCss, ".work-card")).toContain("border-radius: 20px");
    expect(cssRule(appCss, ".work-card")).toContain("backdrop-filter: blur(18px)");
    expect(lastCssRule(appCss, ".library-card")).toContain(
      "background: rgba(15, 16, 24, 0.6)"
    );
    expect(cssRule(appCss, ".library-item")).toContain("border-radius: 6px");
  });

  it("defines persistent desktop navigation and a mobile drawer fallback", () => {
    expect(cssRule(appCss, ".project-sidebar")).toContain("position: sticky");
    expect(appCss).toContain(".projects-drawer-trigger");
    expect(appCss).toContain("@media (max-width: 900px)");
    expect(appCss).toContain(".project-sidebar {\n    display: none;");
  });

  it("keeps touch controls and modal layers stable", () => {
    expect(cssRule(appCss, ".projects-drawer button")).toContain("min-height: 44px");
    expect(cssRule(appCss, ".project-dialog")).toContain("max-height: min(760px, 90dvh)");
    expect(cssRule(appCss, ".organization-undo")).toContain("position: fixed");
  });

  it("uses tonal hierarchy instead of persistent structural borders", () => {
    expect(lastCssRule(appCss, ".project-sidebar")).toContain("border: 0");
    expect(lastCssRule(appCss, ".command-bar")).toContain("border: 0");
    expect(lastCssRule(appCss, ".work-card")).toContain("border: 0");
    expect(lastCssRule(appCss, ".library-card")).toContain("border: 0");
    expect(lastCssRule(appCss, ".library-item")).toContain("border: 0");
  });

  it("uses readable sans labels while reserving mono for metadata", () => {
    const navigationHeading = lastCssRule(appCss, ".project-navigation-heading");
    const sectionHeading = lastCssRule(appCss, ".library-section-heading strong");
    const groupMetadata = lastCssRule(appCss, ".library-group-heading span");

    expect(navigationHeading).toContain('font-family: "Geist Sans"');
    expect(navigationHeading).toContain("font-size: 0.6875rem");
    expect(navigationHeading).toContain("text-transform: uppercase");
    expect(sectionHeading).toContain("font-size: 1rem");
    expect(sectionHeading).toContain("font-weight: 700");
    expect(groupMetadata).toContain('font-family: "Geist Mono"');
  });

  it("holds the four-weight type contract: 250 display, 500 body, 600 labels, 700 strong", () => {
    const weights = new Set(
      Array.from(appCss.matchAll(/font-weight: (\d+)/g), (m) => m[1])
    );

    expect([...weights].sort()).toEqual(["250", "500", "600", "700"]);
  });

  it("keeps micro-labels tracked and uppercase", () => {
    const microLabels = lastCssRule(appCss, ".library-card .field-label span");

    expect(microLabels).toContain("letter-spacing: 0.06em");
    expect(microLabels).toContain("text-transform: uppercase");
  });
});
