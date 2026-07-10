# FrameWave Borderless Workspace And Typography Refinement

## Goal

Refine the approved FrameWave workspace without changing its layout, workflows, or feature set. Reduce persistent hairline borders and nested visual containers, then strengthen typographic hierarchy so the interface feels calmer, clearer, and more professional.

## Visual Principle

Use tone, spacing, and typography as the primary hierarchy. Borders are reserved for interaction or information that genuinely needs an explicit boundary.

The supplied dashboard reference informs the restraint and clarity of the typography, not the product layout, rounded-card composition, analytics patterns, or decorative data visualizations.

## Surface Hierarchy

- Keep the application canvas near-black.
- Use adjacent graphite tones to distinguish the sidebar, working surface, input areas, and selected rows.
- Remove persistent outer borders from the desktop sidebar, command bar, work surfaces, and reference library.
- Remove borders from ordinary reference rows, search fields, filter groups, passive status panels, and secondary controls.
- Avoid replacing every removed border with a shadow. Shadows are limited to overlays such as dialogs, drawers, and the Undo notice.
- Preserve compact radii already established for the media-workspace design.

## Borders That Remain

- Keyboard focus outlines.
- The media preview and trim selection where the boundary communicates the editable range.
- Selected timeline clips and other active media states.
- Error and destructive confirmation states.
- A subtle dialog shell boundary where it separates the overlay from the backdrop.
- Hairlines that are part of a media scale, waveform, or timeline rather than decorative container chrome.

## Navigation

- Separate the sidebar from the workspace through background tone and the existing gutter.
- Remove the sidebar shell and header divider borders.
- Remove the divider below global navigation and the vertical folder-tree rule.
- Keep active navigation legible with a filled row and the existing restrained accent marker.
- Keep hover states tonal and icon controls borderless.

## Workspace And Library

- Treat the export workspace as one composed surface rather than multiple cards inside cards.
- Keep meaningful spacing between source, trim, naming, export, and saved-reference areas.
- Remove outlines from ordinary drop areas, fields, status panels, and reference rows.
- Use slightly lighter fills for editable controls and hover states.
- Preserve the preview frame boundary because it separates actual media content from surrounding controls.
- Use filled active states for tabs and playing references instead of outlining them.

## Dialogs And Feedback

- Keep one elevated dialog surface with a soft shadow.
- Remove header and contextual divider lines inside dialogs.
- Use filled inputs with focus rings.
- Use tonal destination rows and filled primary or destructive actions.
- Keep error boundaries because they communicate exceptional state.
- Keep the Undo notice elevated and visually separate from the workspace.

## Typography

Use the bundled Geist family only.

- Geist Sans is the default for headings, labels, controls, body copy, navigation, and filenames.
- Geist Mono is reserved for timestamps, durations, technical file details, counters, and processing status.
- Workspace and section headings use 15-16px type at approximately 650 weight.
- Primary controls and navigation use 13-14px type at approximately 550 weight.
- Body and supporting copy use 13-15px type at approximately 450 weight with comfortable line height.
- Metadata uses 11-12px type at approximately 500-600 weight.
- Replace tiny 11px bold sans-serif labels with 12px medium-weight labels where space allows.
- Use high-contrast primary text, readable control text, and quieter supporting text.
- Keep letter spacing at zero.
- Do not imitate the reference with oversized dashboard metrics or introduce a new rounded display font.

## Responsive Behavior

The desktop grid, collapsed rail, mobile drawer, dialogs, and control dimensions remain unchanged. The visual refinement must not introduce horizontal overflow, text clipping, overlapping controls, or smaller touch targets.

## Accessibility

- Preserve all visible keyboard focus rings.
- Maintain readable contrast for primary and secondary text.
- Do not use color as the only selected-state cue; retain the accent marker or icon/text state where already present.
- Keep controls and dialogs semantically unchanged.

## Scope

This is a CSS-focused visual refinement. No React behavior, persistence, export logic, copy, navigation model, project behavior, or library behavior changes are included.

## Verification

- Add CSS contract tests for borderless structural surfaces and the typography rules.
- Run the complete test suite and production build.
- Inspect the workspace at desktop and mobile widths.
- Confirm keyboard focus, dialog separation, active navigation, media boundaries, and responsive layout remain clear.
