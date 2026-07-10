# Borderless Workspace And Typography Refinement Implementation Plan

> **For implementer:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine FrameWave's existing media workspace with tonal hierarchy, fewer persistent borders, and a clearer Geist typography system without changing layout or behavior.

**Architecture:** Keep the existing React structure intact and make a scoped stylesheet-only refinement. Extend the CSS contract test to assert the intended structural surfaces and typography before updating the relevant workspace, sidebar, library, and dialog rules.

**Tech Stack:** React, Vite, TypeScript, CSS, Vitest

---

### Task 1: Lock The Visual Contract

**Files:**
- Modify: `src/lib/workspaceCss.test.ts`

**Step 1: Write failing tests**

Add assertions that structural workspace surfaces have no persistent border, that ordinary library rows are borderless, and that Geist Mono is limited by explicit metadata selectors while key labels use the approved 12px scale and medium weight.

**Step 2: Run the focused test**

Run: `npm test -- --run src/lib/workspaceCss.test.ts`

Expected: FAIL because the existing sidebar, command bar, work card, library card, and reference rows still declare persistent borders and the small-label type rules are unchanged.

### Task 2: Apply Tonal Surface Hierarchy

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`

**Step 1: Update structural surfaces**

Remove persistent borders and nested divider lines from the sidebar, command bar, work surfaces, library shell, reference rows, ordinary controls, and internal dialog sections. Use the existing graphite tokens and spacing for separation.

**Step 2: Preserve meaningful boundaries**

Keep keyboard focus outlines, media preview and trim boundaries, active media selection, error/destructive states, and the dialog overlay boundary.

**Step 3: Run the focused test**

Run: `npm test -- --run src/lib/workspaceCss.test.ts`

Expected: PASS.

### Task 3: Normalize Typography

**Files:**
- Modify: `src/App.css`

**Step 1: Clarify the type hierarchy**

Use Geist Sans for section headings, labels, controls, navigation, and filenames. Reserve Geist Mono for time, duration, counts, file metadata, and processing status. Raise key 11px labels to 12px, reduce unnecessary bold weights, and retain zero letter spacing.

**Step 2: Run the full test suite and build**

Run: `npm test -- --run`

Expected: all tests pass.

Run: `npm run build`

Expected: production build succeeds.

### Task 4: Visual Verification

**Files:**
- No file changes expected.

**Step 1: Inspect desktop**

Open the local app at a wide desktop viewport and verify the sidebar, export workspace, saved-reference library, dialogs, active states, and typography form a clear hierarchy without nested outlines.

**Step 2: Inspect mobile**

Verify the mobile workspace and project drawer have no horizontal overflow, clipped text, overlapping controls, or reduced touch targets.

**Step 3: Verify keyboard states**

Tab through primary controls and confirm visible focus rings remain after persistent borders are removed.

### Task 5: Commit The Refinement

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.css`
- Modify: `src/lib/workspaceCss.test.ts`
- Create: `docs/superpowers/specs/2026-07-10-borderless-typography-refinement.md`
- Create: `docs/plans/2026-07-10-borderless-typography-refinement.md`

**Step 1: Review the diff**

Confirm only visual rules, tests, and design documentation changed.

**Step 2: Commit**

```bash
git add src/index.css src/App.css src/lib/workspaceCss.test.ts docs/superpowers/specs/2026-07-10-borderless-typography-refinement.md docs/plans/2026-07-10-borderless-typography-refinement.md
git commit -m "style: refine workspace hierarchy and typography"
```
