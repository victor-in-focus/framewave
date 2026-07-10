// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LibraryLocation,
  Project,
  ProjectCounts,
  ProjectFolder
} from "../lib/projectLibrary";
import { ProjectSidebar } from "./ProjectSidebar";

const projects: Project[] = [
  {
    id: "p1",
    name: "Midnight Train",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
  },
  {
    id: "p2",
    name: "Campaign",
    createdAt: "2026-07-10T01:00:00.000Z",
    updatedAt: "2026-07-10T01:00:00.000Z"
  }
];

const folders: ProjectFolder[] = [
  {
    id: "f1",
    projectId: "p1",
    name: "Finals",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
  }
];

const counts: ProjectCounts = {
  all: 7,
  quick: 2,
  projects: {
    p1: { all: 4, unfiled: 1, folders: { f1: 3 } },
    p2: { all: 1, unfiled: 1, folders: {} }
  }
};

function renderSidebar(
  location: LibraryLocation = { kind: "project-all", projectId: "p1" }
) {
  const onLocationChange = vi.fn();
  const onCollapsedChange = vi.fn();
  render(
    <ProjectSidebar
      projects={projects}
      folders={folders}
      counts={counts}
      location={location}
      collapsed={false}
      onCollapsedChange={onCollapsedChange}
      onLocationChange={onLocationChange}
      onCreateProject={vi.fn()}
      onCreateFolder={vi.fn()}
      onRenameProject={vi.fn()}
      onDeleteProject={vi.fn()}
      onRenameFolder={vi.fn()}
      onDeleteFolder={vi.fn()}
    />
  );
  return { onLocationChange, onCollapsedChange };
}

describe("ProjectSidebar", () => {
  beforeEach(() => localStorage.clear());

  it("renders absolute counts and expands only the selected project", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: "All references, 7" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quick exports, 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Midnight Train, 4" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Campaign, 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All clips, 4" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unfiled, 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finals, 3" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "All clips, 1" })).toBeNull();
  });

  it("selects typed locations", async () => {
    const user = userEvent.setup();
    const { onLocationChange } = renderSidebar();

    await user.click(screen.getByRole("button", { name: "Quick exports, 2" }));
    await user.click(screen.getByRole("button", { name: "Finals, 3" }));

    expect(onLocationChange).toHaveBeenNthCalledWith(1, { kind: "quick" });
    expect(onLocationChange).toHaveBeenNthCalledWith(2, {
      kind: "folder",
      projectId: "p1",
      folderId: "f1"
    });
  });

  it("persists collapse preference and keeps an accessible label", async () => {
    const user = userEvent.setup();
    const { onCollapsedChange } = renderSidebar();

    const collapse = screen.getByRole("button", { name: "Collapse projects" });
    expect(collapse.getAttribute("title")).toBe("Collapse projects");
    await user.click(collapse);

    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(localStorage.getItem("framewave:projectSidebarCollapsed")).toBe("true");
  });

  it("opens a mobile drawer, manages focus, and closes on Escape", async () => {
    const user = userEvent.setup();
    renderSidebar({ kind: "quick" });

    const trigger = screen.getByRole("button", { name: "Projects" });
    await user.click(trigger);

    const drawer = screen.getByRole("dialog", { name: "Projects" });
    expect(within(drawer).getByRole("button", { name: "Close projects" })).toBe(
      document.activeElement
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Projects" })).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });
});
