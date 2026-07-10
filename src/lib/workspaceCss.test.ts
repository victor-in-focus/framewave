import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appCss = readFileSync(new URL("../App.css", import.meta.url), "utf8");
const indexCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");

function cssRule(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));
  return match?.[1] ?? "";
}

describe("professional workspace visual contract", () => {
  it("uses a single dark graphite token system", () => {
    const root = cssRule(indexCss, ":root");

    expect(root).toContain("--background: #0b0c0e");
    expect(root).toContain("--surface-1: #15171a");
    expect(root).toContain("--surface-2: #1d2024");
    expect(root).toContain("--accent: #b9dc5c");
  });

  it("reserves stable expanded and collapsed sidebar columns", () => {
    expect(cssRule(appCss, ".app-shell")).toContain(
      "grid-template-columns: 232px minmax(0, 1fr)"
    );
    expect(cssRule(appCss, ".app-shell.is-sidebar-collapsed")).toContain(
      "grid-template-columns: 56px minmax(0, 1fr)"
    );
  });

  it("uses joined workspace surfaces instead of floating card shadows", () => {
    expect(cssRule(appCss, ".work-card")).toContain("border-radius: 8px");
    expect(cssRule(appCss, ".library-card")).toContain("box-shadow: none");
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
});
