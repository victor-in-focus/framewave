import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
import { FolderPlus, Inbox, Plus, X } from "lucide-react";
import type { MoveDestination } from "../lib/projectApi";
import {
  validateFolderName,
  validateProjectName,
  type Project,
  type ProjectFolder
} from "../lib/projectLibrary";

interface DialogShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function DialogShell({ open, title, onClose, children }: DialogShellProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current
      ?.querySelector<HTMLElement>("[data-autofocus], input, button")
      ?.focus();
    return () => returnFocusRef.current?.focus();
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="project-dialog-backdrop">
      <section
        className="project-dialog"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <header className="project-dialog-header">
          <strong>{title}</strong>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

interface ProjectEditorDialogProps {
  open: boolean;
  title: string;
  projects: Project[];
  initialName?: string;
  onClose: () => void;
  onSubmit: (input: { name: string; useStarterFolders: boolean }) => void;
}

export function ProjectEditorDialog({
  open,
  title,
  projects,
  initialName = "",
  onClose,
  onSubmit
}: ProjectEditorDialogProps) {
  const [name, setName] = useState(initialName);
  const [useStarterFolders, setUseStarterFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  useEffect(() => {
    if (open) {
      setName(initialName);
      setUseStarterFolders(false);
      setError(null);
    }
  }, [initialName, open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateProjectName(name, projects, initialName || undefined);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    onSubmit({ name: validation.value, useStarterFolders });
  }

  const editing = Boolean(initialName);
  return (
    <DialogShell open={open} title={title} onClose={onClose}>
      <form className="project-dialog-form" onSubmit={submit}>
        <label>
          <span>Project name</span>
          <input
            data-autofocus
            aria-label="Project name"
            aria-describedby={error ? errorId : undefined}
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </label>
        {!editing ? (
          <label className="project-dialog-check">
            <input
              type="checkbox"
              checked={useStarterFolders}
              onChange={(event) => setUseStarterFolders(event.target.checked)}
            />
            <span>Use starter folders</span>
          </label>
        ) : null}
        {error ? (
          <p className="project-dialog-error" id={errorId}>
            {error}
          </p>
        ) : null}
        <div className="project-dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="is-primary" type="submit">
            {editing ? "Save project" : "Create project"}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

interface FolderEditorDialogProps {
  open: boolean;
  title: string;
  projectId: string;
  folders: ProjectFolder[];
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export function FolderEditorDialog({
  open,
  title,
  projectId,
  folders,
  initialName = "",
  onClose,
  onSubmit
}: FolderEditorDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
    }
  }, [initialName, open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateFolderName(
      name,
      projectId,
      folders,
      initialName || undefined
    );
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    onSubmit(validation.value);
  }

  const editing = Boolean(initialName);
  return (
    <DialogShell open={open} title={title} onClose={onClose}>
      <form className="project-dialog-form" onSubmit={submit}>
        <label>
          <span>Folder name</span>
          <input
            data-autofocus
            aria-label="Folder name"
            aria-describedby={error ? errorId : undefined}
            value={name}
            maxLength={80}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </label>
        {error ? (
          <p className="project-dialog-error" id={errorId}>
            {error}
          </p>
        ) : null}
        <div className="project-dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="is-primary" type="submit">
            {editing ? "Save folder" : "Create folder"}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

interface MoveReferenceDialogProps {
  open: boolean;
  clipTitle: string;
  projects: Project[];
  folders: ProjectFolder[];
  onClose: () => void;
  onMove: (destination: MoveDestination) => void;
  onCreateProject: (input: {
    name: string;
    useStarterFolders: boolean;
  }) => void;
  onCreateFolder: (projectId: string, name: string) => void;
}

export function MoveReferenceDialog({
  open,
  clipTitle,
  projects,
  folders,
  onClose,
  onMove,
  onCreateProject,
  onCreateFolder
}: MoveReferenceDialogProps) {
  const [mode, setMode] = useState<"list" | "project" | "folder">("list");
  const [projectName, setProjectName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderProjectId, setFolderProjectId] = useState(projects[0]?.id ?? "");
  const [useStarterFolders, setUseStarterFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode("list");
      setProjectName("");
      setFolderName("");
      setFolderProjectId(projects[0]?.id ?? "");
      setUseStarterFolders(false);
      setError(null);
    }
  }, [open, projects]);

  function submitNewProject(event: FormEvent) {
    event.preventDefault();
    const validation = validateProjectName(projectName, projects);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    onCreateProject({ name: validation.value, useStarterFolders });
  }

  function submitNewFolder(event: FormEvent) {
    event.preventDefault();
    const validation = validateFolderName(folderName, folderProjectId, folders);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    onCreateFolder(folderProjectId, validation.value);
  }

  return (
    <DialogShell open={open} title="Move reference" onClose={onClose}>
      <p className="project-dialog-context">{clipTitle}</p>
      {mode === "list" ? (
        <div className="move-destination-list">
          <button
            type="button"
            aria-label="Move to Quick exports"
            onClick={() => onMove({ kind: "quick" })}
          >
            <Inbox size={17} aria-hidden="true" />
            <span>Quick exports</span>
          </button>
          {projects.map((project) => (
            <div className="move-destination-project" key={project.id}>
              <strong>{project.name}</strong>
              <button
                type="button"
                aria-label={`Move to ${project.name} Unfiled`}
                onClick={() =>
                  onMove({ kind: "project-unfiled", projectId: project.id })
                }
              >
                <span>Unfiled</span>
              </button>
              {folders
                .filter((folder) => folder.projectId === project.id)
                .map((folder) => (
                  <button
                    type="button"
                    key={folder.id}
                    aria-label={`Move to ${folder.name}`}
                    onClick={() =>
                      onMove({
                        kind: "folder",
                        projectId: project.id,
                        folderId: folder.id
                      })
                    }
                  >
                    <span>{folder.name}</span>
                  </button>
                ))}
            </div>
          ))}
          <div className="move-destination-create">
            <button type="button" onClick={() => setMode("project")}>
              <Plus size={16} aria-hidden="true" />
              <span>New project</span>
            </button>
            <button
              type="button"
              disabled={projects.length === 0}
              onClick={() => setMode("folder")}
            >
              <FolderPlus size={16} aria-hidden="true" />
              <span>New folder</span>
            </button>
          </div>
        </div>
      ) : null}

      {mode === "project" ? (
        <form className="project-dialog-form" onSubmit={submitNewProject}>
          <label>
            <span>New project name</span>
            <input
              data-autofocus
              aria-label="New project name"
              value={projectName}
              maxLength={80}
              onChange={(event) => {
                setProjectName(event.target.value);
                setError(null);
              }}
            />
          </label>
          <label className="project-dialog-check">
            <input
              type="checkbox"
              checked={useStarterFolders}
              onChange={(event) => setUseStarterFolders(event.target.checked)}
            />
            <span>Use starter folders</span>
          </label>
          {error ? <p className="project-dialog-error">{error}</p> : null}
          <div className="project-dialog-actions">
            <button type="button" onClick={() => setMode("list")}>
              Back
            </button>
            <button className="is-primary" type="submit">
              Create project and move
            </button>
          </div>
        </form>
      ) : null}

      {mode === "folder" ? (
        <form className="project-dialog-form" onSubmit={submitNewFolder}>
          <label>
            <span>Project</span>
            <select
              aria-label="Project for new folder"
              value={folderProjectId}
              onChange={(event) => setFolderProjectId(event.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>New folder name</span>
            <input
              data-autofocus
              aria-label="New folder name"
              value={folderName}
              maxLength={80}
              onChange={(event) => {
                setFolderName(event.target.value);
                setError(null);
              }}
            />
          </label>
          {error ? <p className="project-dialog-error">{error}</p> : null}
          <div className="project-dialog-actions">
            <button type="button" onClick={() => setMode("list")}>
              Back
            </button>
            <button className="is-primary" type="submit">
              Create folder and move
            </button>
          </div>
        </form>
      ) : null}
    </DialogShell>
  );
}

interface ConfirmOrganizationDeleteDialogProps {
  open: boolean;
  kind: "project" | "folder";
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmOrganizationDeleteDialog({
  open,
  kind,
  name,
  onClose,
  onConfirm
}: ConfirmOrganizationDeleteDialogProps) {
  return (
    <DialogShell
      open={open}
      title={`Delete ${kind}`}
      onClose={onClose}
    >
      <div className="project-dialog-confirmation">
        <p>
          Delete <strong>{name}</strong>? References will move to {" "}
          {kind === "project" ? "Quick exports" : "the project's Unfiled view"}.
        </p>
        <div className="project-dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="is-danger" type="button" onClick={onConfirm}>
            Delete {kind}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
