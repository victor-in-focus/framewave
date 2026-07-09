# FrameWave Project Navigation Implementation Plan

> **For implementer:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add local projects and folders, a persistent collapsible navigation sidebar, explicit reference organization, and a dark professional workspace reskin without slowing or changing FrameWave's export flow.

**Architecture:** Keep `libraryApi.ts` responsible for the existing IndexedDB connection and clip records, then add a focused project domain module for pure validation/filtering/count logic and a project API for atomic multi-store operations. Render navigation and organizing dialogs as small React components wired by `App.tsx`; every new export continues to save with no project assignment and therefore appears in `Quick exports`. Apply the visual reference only through tokens and workspace styling, preserving the approved layout and feature boundaries.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, IndexedDB, `fake-indexeddb` for storage tests, Testing Library with jsdom for interaction/accessibility tests, Lucide React, CSS.

**Execution skills:** Use `@test-driven-development` for every behavior task, `@design-taste-frontend` for the final visual treatment, and `@verification-before-completion` before the final commit.

---

### Task 1: Establish the Baseline and Browser Test Harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Verify the untouched baseline**

Run: `npm test -- --run && npm run build`

Expected: all existing tests pass and the production build succeeds before feature work starts.

**Step 2: Add browser and IndexedDB test dependencies**

Run:

```bash
npm install --save-dev fake-indexeddb jsdom @testing-library/react @testing-library/user-event
```

Expected: the packages and lockfile update without runtime dependency changes.

**Step 3: Verify the dependency-only change**

Run: `npm test -- --run && npm run build`

Expected: all existing tests and the build remain green.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "test: add project navigation test harness"
```

---

### Task 2: Define Project Navigation Domain Rules

**Files:**
- Create: `src/lib/projectLibrary.ts`
- Create: `src/lib/projectLibrary.test.ts`
- Use: `src/lib/libraryApi.ts:4`

**Step 1: Write failing tests for names, locations, filtering, counts, and recovery**

Cover these cases:

```ts
expect(validateProjectName("  Midnight Train  ", [])).toEqual({
  valid: true,
  value: "Midnight Train",
  error: null
});
expect(validateProjectName("finals", [{ id: "p1", name: "Finals", createdAt: "", updatedAt: "" }]).valid).toBe(false);
expect(filterClipsByLocation(clips, { kind: "quick" }).map(({ id }) => id)).toEqual(["unfiled"]);
expect(filterClipsByLocation(clips, { kind: "project-all", projectId: "p1" })).toHaveLength(3);
expect(filterClipsByLocation(clips, { kind: "project-unfiled", projectId: "p1" })).toHaveLength(1);
expect(filterClipsByLocation(clips, { kind: "folder", projectId: "p1", folderId: "f1" })).toHaveLength(2);
expect(getProjectCounts(clips, projects, folders)).toMatchObject({
  all: 4,
  quick: 1,
  projects: { p1: { all: 3, unfiled: 1, folders: { f1: 2 } } }
});
expect(normalizeAssignment({ projectId: "missing", folderId: "f1" }, projects, folders)).toEqual({ projectId: null, folderId: null });
expect(nextRestoredName("Finals", ["Finals", "Finals restored"])).toBe("Finals restored 2");
```

Also prove that search and favorite sorting/filtering compose after location filtering rather than changing absolute navigation counts.

**Step 2: Run the tests to verify they fail**

Run: `npm test -- --run src/lib/projectLibrary.test.ts`

Expected: FAIL because the module does not exist.

**Step 3: Implement the pure domain module**

Define these public types and functions:

```ts
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFolder {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type LibraryLocation =
  | { kind: "all" }
  | { kind: "quick" }
  | { kind: "project-all"; projectId: string }
  | { kind: "project-unfiled"; projectId: string }
  | { kind: "folder"; projectId: string; folderId: string };

export const STARTER_FOLDER_NAMES = [
  "Character A",
  "Character B",
  "Scene 01",
  "Pickups",
  "Finals"
] as const;

export function validateProjectName(...): NameValidation;
export function validateFolderName(...): NameValidation;
export function filterClipsByLocation(...): LibraryClip[];
export function getProjectCounts(...): ProjectCounts;
export function getLocationLabel(...): string;
export function normalizeAssignment(...): ClipAssignment;
export function nextRestoredName(...): string;
```

Name comparison must trim whitespace, compare case-insensitively, enforce the 80-character limit, and scope folder duplicates to one project. `nextRestoredName` must keep incrementing until the result is unique.

**Step 4: Run focused and full verification**

Run: `npm test -- --run src/lib/projectLibrary.test.ts && npm test -- --run && npm run build`

Expected: domain tests, the full suite, and build pass.

**Step 5: Commit**

```bash
git add src/lib/projectLibrary.ts src/lib/projectLibrary.test.ts
git commit -m "feat: define project navigation rules"
```

---

### Task 3: Extend the IndexedDB Schema Without Moving Existing Clips

**Files:**
- Modify: `src/lib/libraryApi.ts:4-85`
- Modify: `src/lib/libraryApi.ts:150-180`
- Modify: `src/lib/libraryApi.ts:304-330`
- Modify: `src/lib/libraryApi.ts:387-406`
- Modify: `src/lib/libraryApi.ts:510-598`
- Create: `src/lib/librarySchema.test.ts`

**Step 1: Write failing schema and clip-assignment tests**

Use `fake-indexeddb/auto`, isolate each test with a fresh database, and verify:

- Upgrading creates `projects`, `project-folders`, and `library-meta` stores while retaining `clips` and `session`.
- Existing clip records without assignment fields load as `{ projectId: null, folderId: null }`.
- A new `saveLibraryClip` call stores `projectId: null` and `folderId: null` even if a project is currently selected in UI state.
- `withDatabaseStores` aborts the whole transaction when an action throws.

**Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/lib/librarySchema.test.ts`

Expected: FAIL because the new stores, assignment fields, and multi-store helper do not exist.

**Step 3: Update the database schema and clip shape**

Increase `DB_VERSION` by one and add constants for the three new stores. During `onupgradeneeded`, create:

```ts
projects: keyPath "id", indexes "name" and "createdAt"
project-folders: keyPath "id", indexes "projectId" and "createdAt"
library-meta: keyPath "id"
```

Extend `LibraryClip` and `StoredLibraryClip` with nullable `projectId` and `folderId`. Normalize missing legacy fields to `null` in `toLibraryClip`, and always initialize both fields to `null` in `saveLibraryClip` and imported/batch clips.

Add an atomic helper:

```ts
export async function withDatabaseStores<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  action: (stores: Record<string, IDBObjectStore>) => Promise<T> | T
): Promise<T>;
```

If `action` throws, call `transaction.abort()` before rethrowing. Keep the existing single-store helper as a wrapper so current callers do not change.

**Step 4: Run focused and full verification**

Run: `npm test -- --run src/lib/librarySchema.test.ts src/lib/libraryApi.test.ts && npm test -- --run && npm run build`

Expected: storage tests, full suite, and build pass; no clip media is rewritten or deleted.

**Step 5: Commit**

```bash
git add src/lib/libraryApi.ts src/lib/librarySchema.test.ts
git commit -m "feat: add project library database schema"
```

---

### Task 4: Add Versioned Assignment Repair and Project CRUD

**Files:**
- Create: `src/lib/projectApi.ts`
- Create: `src/lib/projectApi.test.ts`
- Use: `src/lib/projectLibrary.ts`
- Use: `src/lib/libraryApi.ts`

**Step 1: Write failing migration and CRUD tests**

Test:

- Migration version `1` is recorded only after a successful repair.
- Running initialization twice is idempotent.
- A clip with a missing project is repaired to `Quick exports`.
- A clip with a valid project and missing/mismatched folder is repaired to project `Unfiled`.
- A repair failure leaves the original clip record readable and does not write the migration marker.
- Create project with and without the five starter folders.
- Create folder, rename project/folder, and reject empty, duplicate, overlong, or cross-project-invalid names.
- All list methods return creation order.

**Step 2: Run the tests to verify they fail**

Run: `npm test -- --run src/lib/projectApi.test.ts`

Expected: FAIL because `projectApi.ts` does not exist.

**Step 3: Implement initialization and CRUD**

Expose this API:

```ts
export async function initializeProjectLibrary(): Promise<void>;
export async function fetchProjects(): Promise<Project[]>;
export async function fetchProjectFolders(): Promise<ProjectFolder[]>;
export async function createProject(input: {
  name: string;
  useStarterFolders?: boolean;
}): Promise<{ project: Project; folders: ProjectFolder[] }>;
export async function renameProject(projectId: string, name: string): Promise<Project>;
export async function createProjectFolder(projectId: string, name: string): Promise<ProjectFolder>;
export async function renameProjectFolder(folderId: string, name: string): Promise<ProjectFolder>;
```

`initializeProjectLibrary` must read projects, folders, clips, and metadata in one read/write transaction. Repair assignments using `normalizeAssignment`; only write changed clip records, preserve each clip blob, and write `{ id: "project-library-schema", version: 1 }` last in the same transaction. A failed transaction must leave the previous readable state intact.

**Step 4: Run focused and full verification**

Run: `npm test -- --run src/lib/projectApi.test.ts && npm test -- --run && npm run build`

Expected: migration and CRUD tests, full suite, and build pass.

**Step 5: Commit**

```bash
git add src/lib/projectApi.ts src/lib/projectApi.test.ts
git commit -m "feat: add local project and folder storage"
```

---

### Task 5: Add Atomic Move, Delete, and Undo Operations

**Files:**
- Modify: `src/lib/projectApi.ts`
- Modify: `src/lib/projectApi.test.ts`

**Step 1: Write failing move and recovery tests**

Cover:

- Move a clip to `Quick exports`, project `Unfiled`, or a valid folder.
- Reject a folder that belongs to a different project without changing the clip.
- Create a project from the move flow and place the clip in that project's `Unfiled` view, even when starter folders are requested.
- Create a folder from the move flow and place the clip there in the same transaction.
- Delete a folder, move its clips to project `Unfiled`, and return an undo snapshot.
- Delete a project and its folders, move its clips to `Quick exports`, and return an undo snapshot.
- Restore names, folders, and eligible assignments on Undo.
- Do not restore a clip that the user moved after deletion.
- Resolve restored-name conflicts with a unique `restored`, `restored 2`, and so on suffix.
- Simulated request/transaction failure leaves all records unchanged.

**Step 2: Run the tests to verify they fail**

Run: `npm test -- --run src/lib/projectApi.test.ts`

Expected: FAIL on the unimplemented operations.

**Step 3: Implement atomic organization operations**

Add:

```ts
export async function moveReference(clipId: string, destination: MoveDestination): Promise<LibraryClip>;
export async function createProjectAndMoveReference(...): Promise<ProjectMoveResult>;
export async function createFolderAndMoveReference(...): Promise<FolderMoveResult>;
export async function deleteProjectFolder(folderId: string): Promise<FolderUndoSnapshot>;
export async function restoreProjectFolder(snapshot: FolderUndoSnapshot): Promise<void>;
export async function deleteProject(projectId: string): Promise<ProjectUndoSnapshot>;
export async function restoreProject(snapshot: ProjectUndoSnapshot): Promise<void>;
```

Each operation must use one read/write transaction across every affected store. Snapshots record the post-delete `updatedAt` written to each affected clip; Undo restores only clips still at that exact post-delete state, so a later move wins.

**Step 4: Run focused and full verification**

Run: `npm test -- --run src/lib/projectApi.test.ts && npm test -- --run && npm run build`

Expected: all atomicity and Undo tests, full suite, and build pass.

**Step 5: Commit**

```bash
git add src/lib/projectApi.ts src/lib/projectApi.test.ts
git commit -m "feat: add safe reference organization operations"
```

---

### Task 6: Build the Accessible Project Sidebar and Mobile Drawer

**Files:**
- Create: `src/components/ProjectSidebar.tsx`
- Create: `src/components/ProjectSidebar.test.tsx`
- Modify: `src/lib/settings.test.ts`
- Use: `src/lib/settings.ts`
- Use: `src/lib/projectLibrary.ts`

**Step 1: Write failing component tests**

With `// @vitest-environment jsdom`, render the sidebar and verify:

- `All references`, `Quick exports`, project rows, `All clips`, `Unfiled`, and selected-project folders render with absolute counts.
- Selecting a row calls `onLocationChange` with the correct typed location.
- Only the selected project expands.
- Expanded/collapsed state persists under `framewave:projectSidebarCollapsed`.
- Collapsed controls retain accessible names and tooltips.
- The mobile `Projects` button opens a dialog/drawer, places focus inside it, closes on Escape/navigation, and returns focus to the opener.
- Add project, add folder, rename, and delete actions are keyboard reachable.

**Step 2: Run the tests to verify they fail**

Run: `npm test -- --run src/components/ProjectSidebar.test.tsx src/lib/settings.test.ts`

Expected: FAIL because the component and preference do not exist.

**Step 3: Implement the sidebar**

Use Lucide icons (`Library`, `Inbox`, `Folder`, `FolderOpen`, `PanelLeftClose`, `PanelLeftOpen`, `Plus`, `MoreHorizontal`, `X`) rather than custom SVG. Keep all labels visible when expanded; use `aria-label` and `title` when collapsed. Render the same navigation tree inside a mobile modal drawer with a backdrop, focus entry/return, and Escape handling.

The component owns only presentation state such as drawer open/closed. `App.tsx` remains the source of truth for selected location, projects, folders, and counts.

**Step 4: Run focused and full verification**

Run: `npm test -- --run src/components/ProjectSidebar.test.tsx src/lib/settings.test.ts && npm test -- --run && npm run build`

Expected: navigation interaction tests, full suite, and build pass.

**Step 5: Commit**

```bash
git add src/components/ProjectSidebar.tsx src/components/ProjectSidebar.test.tsx src/lib/settings.test.ts
git commit -m "feat: add accessible project navigation"
```

---

### Task 7: Build Project, Folder, and Move Dialogs

**Files:**
- Create: `src/components/ProjectDialogs.tsx`
- Create: `src/components/ProjectDialogs.test.tsx`
- Use: `src/lib/projectLibrary.ts`

**Step 1: Write failing dialog tests**

Verify:

- New project requires one valid name and defaults `Use starter folders` off.
- New folder is scoped to the selected project.
- Rename validation stays inline and does not close the dialog.
- Move lists `Quick exports`, project `Unfiled`, and existing folders.
- Move offers inline `New project` and `New folder` paths without leaving the dialog.
- Creating a project with starter folders still selects project `Unfiled` as the move destination.
- Confirm delete dialogs describe relocation, not media deletion.
- Cancel, Escape, successful submit, and focus return work.

**Step 2: Run the tests to verify they fail**

Run: `npm test -- --run src/components/ProjectDialogs.test.tsx`

Expected: FAIL because the dialogs do not exist.

**Step 3: Implement focused dialog components**

Export:

```ts
ProjectEditorDialog
FolderEditorDialog
MoveReferenceDialog
ConfirmOrganizationDeleteDialog
```

Use native form submission, inline error text connected with `aria-describedby`, and visible Cancel/primary actions. Keep each dialog narrowly prop-driven; persistence and library refresh stay in `App.tsx`.

**Step 4: Run focused and full verification**

Run: `npm test -- --run src/components/ProjectDialogs.test.tsx && npm test -- --run && npm run build`

Expected: dialog tests, full suite, and build pass.

**Step 5: Commit**

```bash
git add src/components/ProjectDialogs.tsx src/components/ProjectDialogs.test.tsx
git commit -m "feat: add project organization dialogs"
```

---

### Task 8: Integrate Navigation, Filtering, Moves, and Undo Into the Workspace

**Files:**
- Modify: `src/App.tsx:1-60`
- Modify: `src/App.tsx:201-326`
- Modify: `src/App.tsx:492-523`
- Modify: `src/App.tsx:820-900`
- Modify: `src/App.tsx:944-1040`
- Modify: `src/App.tsx:1093-1107`
- Modify: `src/App.tsx:1631-1850`
- Modify: `src/App.render.test.tsx`
- Modify: `src/lib/libraryDisplay.ts`
- Modify: `src/lib/libraryDisplay.test.ts`
- Modify: `src/lib/libraryMarkup.test.ts`

**Step 1: Write failing integration/markup tests**

Prove:

- The first render contains the `Projects` navigation control while the create-reference surface remains immediately available.
- The workspace renders `All references` and `Quick exports` without requiring a project.
- A reference row includes a labeled `Move reference` action.
- Location filtering happens before search/favorite/sort display logic, while counts use the complete unfiltered clip list.
- The location heading/empty copy matches `Quick exports`, empty project, project `Unfiled`, and empty folder states.
- The completed-export area offers a quiet `Organize` action.

**Step 2: Run the tests to verify they fail**

Run: `npm test -- --run src/App.render.test.tsx src/lib/libraryMarkup.test.ts`

Expected: FAIL on missing navigation, move action, and location content.

**Step 3: Load project state independently from clip search state**

On mount, call `initializeProjectLibrary`, then load all clips, projects, and folders. If initialization fails, keep readable clips visible and show a recoverable organization error with a `Retry` button that reruns initialization. Do not replace the existing export error state.

Change library display derivation to this order:

```ts
const locationClips = filterClipsByLocation(allLibraryClips, location);
const searchedClips = filterLibraryClips(locationClips, libraryQuery);
const visibleLibraryClips = sortLibraryClips(searchedClips, librarySortMode);
const counts = getProjectCounts(allLibraryClips, projects, folders);
```

Add a pure `filterLibraryClips` helper to `libraryDisplay.ts` for query and favorites-only filtering, with focused tests proving it does not mutate input. If `fetchLibrary` currently performs query/favorite filtering, load all records and apply the existing transient filters through this helper so navigation counts remain absolute.

Use the approved empty-state copy exactly:

- `Quick exports`: `New references save here first.`
- Empty project: `Move references here from Quick exports.`
- Project `Unfiled`: `No unfiled references in this project.`
- Empty folder: `No references in this folder yet.`

**Step 4: Wire project and folder actions**

Connect sidebar and dialogs to project API calls. After successful create, rename, move, delete, or Undo, refresh clips/projects/folders together. On failure, retain the prior rendered state and show a recoverable message.

Deleting a folder/project must use the confirmation dialog. Store one active undo snapshot in component state, show a non-focus-stealing toast for about five seconds, and clear the timer on replacement/unmount.

**Step 5: Preserve export destination invariance**

Leave `saveLibraryClip`, imported clips, and batch export calls without project/folder arguments. After a successful single export, capture the returned clip ID so `Organize` opens the move dialog for that clip. Regardless of the selected location, new records stay in `Quick exports` until an explicit move succeeds.

**Step 6: Add row-level organization**

Add a Lucide folder-move icon button to each reference row with `aria-label="Move reference"`, `title="Move reference"`, and the existing quiet action treatment. Do not add drag-and-drop.

**Step 7: Run focused and full verification**

Run: `npm test -- --run src/App.render.test.tsx src/lib/libraryMarkup.test.ts src/lib/projectLibrary.test.ts src/lib/projectApi.test.ts && npm test -- --run && npm run build`

Expected: integration tests, all existing tests, and build pass.

**Step 8: Commit**

```bash
git add src/App.tsx src/App.render.test.tsx src/lib/libraryDisplay.ts src/lib/libraryDisplay.test.ts src/lib/libraryMarkup.test.ts
git commit -m "feat: integrate projects into the reference workspace"
```

---

### Task 9: Apply the Approved Professional Workspace Reskin

**Files:**
- Modify: `src/index.css:15-54`
- Modify: `src/App.css`
- Modify: `src/lib/libraryCss.test.ts`
- Create: `src/lib/workspaceCss.test.ts`
- Use as visual reference only: `/Users/V/Desktop/Screenshot 2026-07-09 at 23.51.14.png`

**Step 1: Write failing visual-contract tests**

Test for stable structural requirements rather than exact screenshots:

- App background is deep black and primary surfaces are graphite.
- Workspace regions use fine borders/dividers and no large floating-card shadows.
- Desktop reserves a stable sidebar column; collapsed state reserves a stable icon rail.
- Mobile hides the persistent sidebar and exposes the drawer trigger.
- Export workspace remains wider/more prominent than the library at desktop widths.
- Project rows, dialogs, move picker, toast, and library rows share the same tokens.
- Icon controls have stable dimensions and text cannot resize their tracks.
- Touch controls in the drawer/dialogs are at least 44px.

**Step 2: Run the CSS tests to verify they fail**

Run: `npm test -- --run src/lib/libraryCss.test.ts src/lib/workspaceCss.test.ts`

Expected: FAIL because the current light library cards and workspace grid do not meet the approved reskin contract.

**Step 3: Introduce dark workspace tokens**

Update `src/index.css` semantic tokens for:

```css
--background: near-black application canvas;
--surface-1: graphite workspace;
--surface-2: raised control/dialog surface;
--foreground: high-contrast text;
--soft-foreground: muted text;
--border: fine low-contrast divider;
--accent: one restrained FrameWave active/primary color;
```

Keep letter spacing at `0`. Do not introduce gradients, decorative blobs, oversized cards, or a one-hue blue/purple palette.

**Step 4: Style the approved layout without changing it**

Retain the create/reference workspace arrangement and add the sidebar around it. Replace floating section-card treatment with joined workspace regions, fine borders, small radii (8px or less for workspace controls/cards unless an existing media control requires otherwise), restrained hover states, and compact toolbar spacing. Keep the export surface visually dominant and preserve all existing trim/media sizing constraints.

Desktop: persistent expanded/collapsed sidebar beside the existing workspace.

Mobile/tablet: no persistent sidebar; labeled `Projects` trigger opens the full-height drawer while the create-reference surface remains first.

**Step 5: Run focused and full verification**

Run: `npm test -- --run src/lib/libraryCss.test.ts src/lib/workspaceCss.test.ts && npm test -- --run && npm run build`

Expected: CSS contract tests, full suite, and build pass.

**Step 6: Commit**

```bash
git add src/index.css src/App.css src/lib/libraryCss.test.ts src/lib/workspaceCss.test.ts
git commit -m "style: reskin FrameWave as a focused media workspace"
```

---

### Task 10: Verify Desktop, Mobile, Recovery, and Real Export Behavior

**Files:**
- Modify only if verification finds an issue.

**Step 1: Run final automated verification**

Run: `npm test -- --run && npm run build`

Expected: the full test suite passes and Vite produces a successful production build.

**Step 2: Start the local app**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL and remains running for browser verification.

**Step 3: Verify desktop behavior in a real browser**

At approximately 1440x900, verify:

- Expanded and collapsed sidebar states do not resize controls unpredictably or overlap the existing workspace.
- Create and export remain immediately usable with no project prompt.
- New single, imported, and batch references appear in `Quick exports` regardless of selected location.
- Create/rename/delete project and folder flows work.
- Move can create a project or folder inline.
- Search and Starred compose with the selected location while counts remain absolute.
- Delete folder/project relocates references and Undo restores eligible assignments.
- Local-library initialization failure exposes Retry without hiding readable references.
- A real source clip exports to a downloadable black-screen MP4 with audio.

**Step 4: Verify responsive and accessible behavior**

At approximately 390x844 and 768x1024, verify:

- No incoherent overlap or horizontal overflow.
- The `Projects` button opens the full-height drawer.
- Drawer controls are comfortable touch targets.
- Keyboard Tab order, Escape, focus entry/return, dialogs, move flow, and Undo are usable.
- Long project/folder/reference names wrap or truncate without escaping their containers.

**Step 5: Inspect browser diagnostics**

Expected: no uncaught errors, React warnings, failed local assets, or IndexedDB transaction errors during the verified flows.

**Step 6: Re-run verification after any fix**

Run: `npm test -- --run && npm run build`

Expected: full suite and build pass after the final browser-driven correction.

**Step 7: Commit verification fixes if any**

```bash
git add <only-files-changed-by-verification>
git commit -m "fix: polish project workspace interactions"
```

Do not create an empty commit when no fix was needed.
