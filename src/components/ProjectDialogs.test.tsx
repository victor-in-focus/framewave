// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Project, ProjectFolder } from "../lib/projectLibrary";
import {
  ConfirmOrganizationDeleteDialog,
  FolderEditorDialog,
  MoveReferenceDialog,
  ProjectEditorDialog
} from "./ProjectDialogs";

const projects: Project[] = [
  {
    id: "p1",
    name: "Midnight Train",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z"
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

describe("project editor dialogs", () => {
  it("keeps project validation inline and defaults starter folders off", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ProjectEditorDialog
        open
        title="New project"
        projects={projects}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(
      (screen.getByRole("checkbox", {
        name: "Use starter folders"
      }) as HTMLInputElement).checked
    ).toBe(false);
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByText("Enter a name.")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "New project" })).toBeTruthy();

    await user.type(screen.getByLabelText("Project name"), "New Film");
    await user.click(screen.getByRole("checkbox", { name: "Use starter folders" }));
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "New Film",
      useStarterFolders: true
    });
  });

  it("validates a folder inside its project", async () => {
    const user = userEvent.setup();
    render(
      <FolderEditorDialog
        open
        title="New folder"
        projectId="p1"
        folders={folders}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText("Folder name"), " finals ");
    await user.click(screen.getByRole("button", { name: "Create folder" }));
    expect(screen.getByText("That name is already in use.")).toBeTruthy();
  });
});

describe("MoveReferenceDialog", () => {
  it("offers existing destinations and typed move choices", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(
      <MoveReferenceDialog
        open
        clipTitle="Ava calm"
        projects={projects}
        folders={folders}
        onClose={vi.fn()}
        onMove={onMove}
        onCreateProject={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Move to Quick exports" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move to Midnight Train Unfiled" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Move to Finals" }));
    expect(onMove).toHaveBeenCalledWith({
      kind: "folder",
      projectId: "p1",
      folderId: "f1"
    });
  });

  it("creates a project inline and leaves the reference Unfiled", async () => {
    const user = userEvent.setup();
    const onCreateProject = vi.fn();
    render(
      <MoveReferenceDialog
        open
        clipTitle="Ava calm"
        projects={projects}
        folders={folders}
        onClose={vi.fn()}
        onMove={vi.fn()}
        onCreateProject={onCreateProject}
        onCreateFolder={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("New project name"), "Campaign");
    await user.click(screen.getByRole("checkbox", { name: "Use starter folders" }));
    await user.click(screen.getByRole("button", { name: "Create project and move" }));
    expect(onCreateProject).toHaveBeenCalledWith({
      name: "Campaign",
      useStarterFolders: true
    });
  });

  it("creates a folder inline without leaving the move flow", async () => {
    const user = userEvent.setup();
    const onCreateFolder = vi.fn();
    render(
      <MoveReferenceDialog
        open
        clipTitle="Ava calm"
        projects={projects}
        folders={folders}
        onClose={vi.fn()}
        onMove={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateFolder={onCreateFolder}
      />
    );

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(screen.getByLabelText("New folder name"), "Scene 02");
    await user.click(screen.getByRole("button", { name: "Create folder and move" }));
    expect(onCreateFolder).toHaveBeenCalledWith("p1", "Scene 02");
  });
});

describe("organization delete confirmation", () => {
  it("describes relocation instead of media deletion", () => {
    render(
      <ConfirmOrganizationDeleteDialog
        open
        kind="project"
        name="Midnight Train"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/move to Quick exports/i)).toBeTruthy();
    expect(screen.queryByText(/delete media/i)).toBeNull();
  });
});
