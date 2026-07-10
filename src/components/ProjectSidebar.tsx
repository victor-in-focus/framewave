import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Inbox,
  Library,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { setSetting } from "../lib/settings";
import type {
  LibraryLocation,
  Project,
  ProjectCounts,
  ProjectFolder
} from "../lib/projectLibrary";

const SIDEBAR_COLLAPSED_KEY = "projectSidebarCollapsed";

interface ProjectSidebarProps {
  projects: Project[];
  folders: ProjectFolder[];
  counts: ProjectCounts;
  location: LibraryLocation;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onLocationChange: (location: LibraryLocation) => void;
  onCreateProject: () => void;
  onCreateFolder: (projectId: string) => void;
  onRenameProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onRenameFolder: (folder: ProjectFolder) => void;
  onDeleteFolder: (folder: ProjectFolder) => void;
}

function selectedProjectId(location: LibraryLocation): string | null {
  return "projectId" in location ? location.projectId : null;
}

function isLocationActive(
  current: LibraryLocation,
  candidate: LibraryLocation
): boolean {
  return JSON.stringify(current) === JSON.stringify(candidate);
}

export function ProjectSidebar({
  projects,
  folders,
  counts,
  location,
  collapsed,
  onCollapsedChange,
  onLocationChange,
  onCreateProject,
  onCreateFolder,
  onRenameProject,
  onDeleteProject,
  onRenameFolder,
  onDeleteFolder
}: ProjectSidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const activeProjectId = selectedProjectId(location);

  useEffect(() => {
    if (drawerOpen) {
      drawerCloseRef.current?.focus();
    }
  }, [drawerOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    setSetting(SIDEBAR_COLLAPSED_KEY, next);
    onCollapsedChange(next);
  }

  function closeDrawer(returnFocus = true) {
    setDrawerOpen(false);
    if (returnFocus) {
      window.setTimeout(() => drawerTriggerRef.current?.focus(), 0);
    }
  }

  function chooseLocation(next: LibraryLocation, fromDrawer: boolean) {
    onLocationChange(next);
    if (fromDrawer) {
      closeDrawer();
    }
  }

  function navigationTree(fromDrawer: boolean) {
    return (
      <nav className="project-navigation" aria-label="Reference locations">
        <div className="project-navigation-primary">
          <button
            className={
              isLocationActive(location, { kind: "all" }) ? "is-active" : ""
            }
            type="button"
            aria-label={`All references, ${counts.all}`}
            aria-current={
              isLocationActive(location, { kind: "all" }) ? "page" : undefined
            }
            onClick={() => chooseLocation({ kind: "all" }, fromDrawer)}
          >
            <Library size={17} aria-hidden="true" />
            <span>All references</span>
            <small>{counts.all}</small>
          </button>
          <button
            className={
              isLocationActive(location, { kind: "quick" }) ? "is-active" : ""
            }
            type="button"
            aria-label={`Quick exports, ${counts.quick}`}
            aria-current={
              isLocationActive(location, { kind: "quick" }) ? "page" : undefined
            }
            onClick={() => chooseLocation({ kind: "quick" }, fromDrawer)}
          >
            <Inbox size={17} aria-hidden="true" />
            <span>Quick exports</span>
            <small>{counts.quick}</small>
          </button>
        </div>

        <div className="project-navigation-heading">
          <span>Projects</span>
          <button
            type="button"
            title="New project"
            aria-label="New project"
            onClick={onCreateProject}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="project-navigation-list">
          {projects.map((project) => {
            const expanded = activeProjectId === project.id;
            const projectCounts = counts.projects[project.id] ?? {
              all: 0,
              unfiled: 0,
              folders: {}
            };
            return (
              <div className="project-navigation-project" key={project.id}>
                <div className="project-navigation-row">
                  <button
                    className={
                      expanded && location.kind === "project-all" ? "is-active" : ""
                    }
                    type="button"
                    aria-label={`${project.name}, ${projectCounts.all}`}
                    aria-expanded={expanded}
                    onClick={() =>
                      chooseLocation(
                        { kind: "project-all", projectId: project.id },
                        fromDrawer
                      )
                    }
                  >
                    {expanded ? (
                      <ChevronDown size={14} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={14} aria-hidden="true" />
                    )}
                    {expanded ? (
                      <FolderOpen size={17} aria-hidden="true" />
                    ) : (
                      <Folder size={17} aria-hidden="true" />
                    )}
                    <span>{project.name}</span>
                    <small>{projectCounts.all}</small>
                  </button>
                  {expanded ? (
                    <div className="project-navigation-actions">
                      <button
                        type="button"
                        title={`Rename ${project.name}`}
                        aria-label={`Rename ${project.name}`}
                        onClick={() => onRenameProject(project)}
                      >
                        <MoreHorizontal size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title={`Delete ${project.name}`}
                        aria-label={`Delete ${project.name}`}
                        onClick={() => onDeleteProject(project)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {expanded ? (
                  <div className="project-navigation-children">
                    <button
                      className={location.kind === "project-all" ? "is-active" : ""}
                      type="button"
                      aria-label={`All clips, ${projectCounts.all}`}
                      onClick={() =>
                        chooseLocation(
                          { kind: "project-all", projectId: project.id },
                          fromDrawer
                        )
                      }
                    >
                      <span>All clips</span>
                      <small>{projectCounts.all}</small>
                    </button>
                    <button
                      className={
                        location.kind === "project-unfiled" ? "is-active" : ""
                      }
                      type="button"
                      aria-label={`Unfiled, ${projectCounts.unfiled}`}
                      onClick={() =>
                        chooseLocation(
                          { kind: "project-unfiled", projectId: project.id },
                          fromDrawer
                        )
                      }
                    >
                      <span>Unfiled</span>
                      <small>{projectCounts.unfiled}</small>
                    </button>
                    {folders
                      .filter((folder) => folder.projectId === project.id)
                      .map((folder) => (
                        <div className="project-navigation-child-row" key={folder.id}>
                          <button
                            className={
                              location.kind === "folder" &&
                              location.folderId === folder.id
                                ? "is-active"
                                : ""
                            }
                            type="button"
                            aria-label={`${folder.name}, ${
                              projectCounts.folders[folder.id] ?? 0
                            }`}
                            onClick={() =>
                              chooseLocation(
                                {
                                  kind: "folder",
                                  projectId: project.id,
                                  folderId: folder.id
                                },
                                fromDrawer
                              )
                            }
                          >
                            <Folder size={14} aria-hidden="true" />
                            <span>{folder.name}</span>
                            <small>{projectCounts.folders[folder.id] ?? 0}</small>
                          </button>
                          <div className="project-navigation-actions">
                            <button
                              type="button"
                              title={`Rename ${folder.name}`}
                              aria-label={`Rename ${folder.name}`}
                              onClick={() => onRenameFolder(folder)}
                            >
                              <MoreHorizontal size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              title={`Delete ${folder.name}`}
                              aria-label={`Delete ${folder.name}`}
                              onClick={() => onDeleteFolder(folder)}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    <button
                      className="project-navigation-add-folder"
                      type="button"
                      onClick={() => onCreateFolder(project.id)}
                    >
                      <Plus size={14} aria-hidden="true" />
                      <span>New folder</span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <>
      <aside
        className={`project-sidebar${collapsed ? " is-collapsed" : ""}`}
        aria-label="Projects"
      >
        <div className="project-sidebar-header">
          <strong>FrameWave</strong>
          <button
            type="button"
            title={collapsed ? "Expand projects" : "Collapse projects"}
            aria-label={collapsed ? "Expand projects" : "Collapse projects"}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={17} aria-hidden="true" />
            )}
          </button>
        </div>
        {navigationTree(false)}
      </aside>

      <button
        className="projects-drawer-trigger"
        ref={drawerTriggerRef}
        type="button"
        aria-label="Projects"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
      >
        <FolderOpen size={17} aria-hidden="true" />
        <span>Projects</span>
      </button>

      {drawerOpen ? (
        <div className="projects-drawer-backdrop">
          <section
            className="projects-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Projects"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeDrawer();
              }
            }}
          >
            <header>
              <strong>Projects</strong>
              <button
                ref={drawerCloseRef}
                type="button"
                title="Close projects"
                aria-label="Close projects"
                onClick={() => closeDrawer()}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            {navigationTree(true)}
          </section>
        </div>
      ) : null}
    </>
  );
}
