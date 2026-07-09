# FrameWave Project Navigation Design

## Goal

Add lightweight organization for saved voice-reference clips without slowing down the core export flow.

FrameWave should still feel like a fast single-purpose tool: drop media in, create a black-screen voice-reference MP4, download it, and keep moving. Projects and folders are a secondary organization layer for people working across films, campaigns, characters, scenes, pickups, and finals.

## Product Principle

New exports should never require an organization decision.

By default, every newly saved reference lands in `Quick exports`, a global unfiled inbox. The completion state can offer a quiet `Organize` action, but export and download remain immediate. Users who never want projects can ignore the sidebar and keep using FrameWave exactly as a quick-start converter.

This rule applies even when the user is currently viewing a project or folder. The active sidebar selection never becomes an implicit export destination. A reference moves out of `Quick exports` only when the user deliberately uses `Organize`, `Move to...`, or another explicit organizing action.

## Information Architecture

The navigation model has four levels:

- `All references`: every locally saved clip.
- `Quick exports`: unfiled clips with no project.
- `Projects`: named containers such as a film, campaign, episode, or client job.
- Project folders: optional filters inside a project, such as `Character A`, `Scene 01`, `Pickups`, or `Finals`.

Opening a project shows `All clips` for that project first, including both foldered and unfoldered clips. A project also has an `Unfiled` view for clips assigned to the project but not assigned to a folder. Selecting a folder filters the project to clips in that folder only. A clip can belong to one project and optionally one folder. Tags and favorites remain independent of projects and folders.

In navigation, the selected project expands to show `All clips`, `Unfiled`, then its folders in creation order. These are visible child rows in both the desktop sidebar and mobile drawer.

Counts:

- `All references` count includes every locally saved clip.
- `Quick exports` count includes clips with no project.
- Project count includes every clip in that project, including foldered and unfoldered clips.
- `All clips` count matches the project count.
- `Unfiled` count includes only clips in the project with no folder.
- Folder count includes only clips directly assigned to that folder.

## Desktop Experience

The left sidebar is persistent and collapsible.

Expanded state:

- Shows `All references`, `Quick exports`, and `Projects`.
- Shows each project as a labeled row with count and active state.
- Shows the selected project's `All clips`, `Unfiled`, and folders underneath it.
- Includes visible actions for creating a project, creating a folder in the selected project, and managing the selected project or folder.
- Supports keyboard access for navigation and visible actions.

Collapsed state:

- Keeps a slim rail with recognizable icons and accessible labels.
- Remembers the user's preference locally.
- Keeps the main export surface wide and usable.

The main content area keeps the current export workflow as the priority. When viewing a project or folder, a compact location label appears above the library list, for example `Midnight Train / Finals`.

## Mobile And Tablet Experience

On smaller screens, the same hierarchy appears in a full-height drawer opened from a labeled `Projects` control.

The drawer:

- Closes after navigation.
- Has a visible close control and supports Escape where available.
- Moves focus into the drawer when opened and returns focus to the `Projects` control when closed.
- Uses touch targets of at least 44px.
- Avoids gesture-only behavior.
- Does not cover required export controls while closed.

The export surface remains the default first screen on mobile. Organization stays available, but it should not compete with creating the reference video.

## Project Creation

Creating a project asks for only one required field: project name.

The default path creates a blank project. This avoids clutter and keeps project creation as simple as typing a name.

The creation flow also offers `Use starter folders` for users who want a ready structure. Starter folders are:

- `Character A`
- `Character B`
- `Scene 01`
- `Pickups`
- `Finals`

Starter folders can be renamed, added, or deleted later. Manual reordering is out of scope for the first implementation; projects and folders can use creation order.

Outside the move picker, a user creates a folder from the selected project's sidebar or project header action. Folder creation is scoped to the selected project and asks only for the folder name.

Project and folder names:

- Trim leading and trailing whitespace.
- Reject empty or whitespace-only names.
- Limit names to 80 characters.
- Prevent duplicate project names.
- Prevent duplicate folder names inside the same project.
- Allow the same folder name in different projects.
- Treat names as duplicates after trimming whitespace and comparing case-insensitively, so `Finals`, ` finals `, and `FINALS` conflict.
- Show validation inline without closing the creation or rename flow.

## Organize And Move Flow

Moving a reference is available from the clip row/card and from the post-export `Organize` action.

The move picker supports:

- Moving to `Quick exports`.
- Moving to a project's `Unfiled` view.
- Moving to an existing folder inside a project.
- Creating a new project inline, then moving the reference there.
- Creating a new folder inline once a project is selected, then moving the reference there.

Inline creation should stay in the same flow. Creating a project asks only for a name by default, with `Use starter folders` as an optional choice. Creating a folder asks only for the folder name.

When a user creates a new project from the move picker, the moved reference lands in that new project's `Unfiled` view by default. This remains true if the user enables `Use starter folders`; the user can choose a starter folder afterward only through an explicit second selection.

Drag and drop is out of scope for the first implementation unless it already exists in the app. The visible `Move to...` action is the dependable path.

## Data Model

The feature remains fully client-side and local.

Add local records for:

- `Project`: id, name, created time, updated time.
- `ProjectFolder`: id, project id, name, created time, updated time.

Extend saved references with:

- Optional `projectId`.
- Optional `folderId`.

Rules:

- A reference with no `projectId` is in `Quick exports`.
- A reference with `projectId` and no `folderId` appears in that project's `All clips` and `Unfiled` views.
- A `folderId` is valid only when the folder belongs to the same project.
- Invalid moves fail without changing the saved reference.
- Existing saved references migrate untouched into `Quick exports`.
- Migration is versioned and idempotent.
- If a saved reference has `folderId` but no `projectId`, clear `folderId` and keep the reference in `Quick exports`.
- If a saved reference points to a missing project, clear both `projectId` and `folderId` and keep the reference in `Quick exports`.
- If a saved reference points to a valid project but a missing or mismatched folder, keep `projectId`, clear `folderId`, and show it in that project's `Unfiled` view.
- If migration fails or partially writes, existing references must remain readable and clip media must not be deleted. The app should fall back to the last readable local state and surface a recoverable local-library error rather than silently dropping saved clips.
- Organizing writes are atomic from the user's point of view. Move, rename, delete folder, delete project, and Undo should either fully apply or leave the previous readable library state intact.

No upload, account, server sync, email capture, export cap, or watermark is introduced.

No new UI copy, metadata, tests, fixture names, migration labels, or storage names should introduce or revive the app's old product name.

## Safety And Recovery

Organizing actions must not delete clip media.

- Renaming a project or folder is inline and reversible by editing again.
- Deleting a folder asks for confirmation, then moves its clips to that project's `Unfiled` view and shows Undo.
- Deleting a project asks for confirmation, then moves its clips to `Quick exports` and shows Undo.
- Deleting an individual reference remains the only destructive media deletion and keeps its existing confirmation.

Deleting a project also removes its folders. Undo restores the deleted project, its folders, folder names, and eligible clip folder assignments when those clips have not been moved again after the delete action. Undo for a deleted folder restores the folder, its name, and eligible clip assignments. Undo must not overwrite a later user move made during the undo window. If another project or folder has taken the original name before Undo runs, restore the deleted item with a simple disambiguated suffix, for example `Finals restored`. Undo is an in-session recovery action shown for a short toast window, around 5 seconds. It does not need to survive a page reload. The action should be visible without stealing focus from the user.

## Empty States

Empty states should be plain and action-oriented.

- Empty `Quick exports`: "New references save here first."
- Empty project: "Move references here from Quick exports."
- Empty folder: "No references in this folder yet."
- Empty project `Unfiled`: "No unfiled references in this project."

The empty states should not explain the whole feature. They should provide the next useful action only.

## Filtering And Accessibility

Sidebar counts are absolute organizational totals. They do not change because of transient search, tag, favorite, or media-type filters unless the existing library already uses filtered counts consistently everywhere.

Navigation controls need accessible names even when the sidebar is collapsed. Icon-only controls require labels for assistive technology and tooltips for sighted users. Keyboard users must be able to open the sidebar or drawer, navigate projects and folders, create destinations, move references, and close dialogs/drawers without using a pointer.

## Testing

Coverage should focus on behavior and migration rather than visuals alone.

Add or update tests for:

- Existing references load as `Quick exports`.
- Migration is versioned and idempotent.
- Migration failure preserves readable references and media.
- Failed organizing writes preserve the previous readable library state.
- Orphaned project and folder references recover without losing clips.
- Creating, renaming, and deleting projects.
- Creating, renaming, and deleting folders.
- Project and folder name validation.
- Moving references to `Quick exports`, project `Unfiled`, existing folder, new project, and new folder.
- Creating a new project with starter folders from the move picker places the moved reference in `Unfiled` until the user explicitly chooses a folder.
- Rejecting invalid project/folder combinations.
- Exports from `All references`, `Quick exports`, a project, and a folder still save to `Quick exports` unless explicitly organized.
- Sidebar count correctness for global views, projects, `All clips`, `Unfiled`, and folders.
- Sidebar counts remain absolute while transient filters are active.
- Folder deletion moves clips to `Unfiled` with Undo.
- Project deletion moves clips to `Quick exports` with Undo.
- Project deletion removes child folders, and Undo restores the project, folders, folder names, and eligible clip assignments.
- Undo restores names and affected clip assignments within the active session without overwriting moves made after the delete, and handles name conflicts with a disambiguated restored name.
- Partial failures during move, rename, delete folder, delete project, and Undo preserve the previous readable library state.
- Sidebar collapsed state persistence.
- Mobile drawer navigation state.
- Keyboard access and focus management for sidebar, drawer, and move picker.
- Existing export, library, branding, and build tests remain green.

## Acceptance Criteria

- A first-time user can create and download a reference without seeing a required project or folder choice.
- A returning user can organize clips by film or campaign from a persistent collapsible sidebar.
- `Move reference` can create a destination without leaving the flow.
- Exports always save to `Quick exports` until the user explicitly organizes them.
- Existing saved clips remain available after migration.
- All data stays local in the browser.
- Navigation works with keyboard and assistive labels in expanded, collapsed, and mobile drawer states.
- Tests and production build pass.
