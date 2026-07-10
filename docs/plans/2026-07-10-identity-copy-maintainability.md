# Identity, Guidance, And Maintainability Implementation Plan

> **For implementer:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Credit VictorInFocus consistently, remove unwanted contributor attribution from files and public history, improve interface guidance, and make a small low-risk code cleanup.

**Architecture:** Keep product behavior unchanged. Add file-content and server-render contract tests, centralize app identity constants, update copy and title attributes in existing components, then rewrite repository history only after the code change is committed and fully verified.

**Tech Stack:** React, TypeScript, Vite, Vitest, Git, GitHub CLI

---

### Task 1: Lock Identity And Guidance Contracts

**Files:**
- Modify: `src/lib/branding.test.ts`
- Modify: `src/App.render.test.tsx`
- Modify: `src/components/ProjectDialogs.test.tsx`
- Modify: `src/components/ProjectSidebar.test.tsx`

**Steps:**

1. Add failing assertions for the VictorInFocus creator identity.
2. Add failing assertions for the approved placeholders and high-value tooltips.
3. Run the focused tests and confirm they fail for the expected old copy.

### Task 2: Update Identity And Interface Guidance

**Files:**
- Create: `src/lib/brand.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ProjectDialogs.tsx`
- Modify: `src/components/ProjectSidebar.tsx`
- Modify: `README.md`
- Modify: `LICENSE`
- Modify: `.gitignore`
- Delete local obsolete assistant settings.

**Steps:**

1. Move creator URLs and display identity into `src/lib/brand.ts`.
2. Replace creator credits with VictorInFocus.
3. Apply the approved placeholders and action-oriented tooltips.
4. Remove obsolete local assistant configuration and ignore entries.
5. Run the focused tests until they pass.

### Task 3: Apply Conservative Code Cleanup

**Files:**
- Modify: `src/App.tsx`

**Steps:**

1. Compute each reference row's limited tag set once per render.
2. Keep component boundaries and behavior otherwise unchanged.
3. Run all tests, the production build, and dependency audit.

### Task 4: Commit Tracked Changes

**Steps:**

1. Configure the repository-local Git identity for VictorInFocus.
2. Review the complete diff and verify no unrelated changes exist.
3. Commit with `chore: refine identity and interface guidance`.

### Task 5: Rewrite Public History

**Steps:**

1. Confirm the worktree is clean and record the current remote hash.
2. Create a temporary bundle outside the worktree.
3. Rewrite historic creator credits, obsolete ignore entries, co-author trailers, and author/committer identity.
4. Verify rewritten files and messages locally.
5. Force-push `main` using an explicit lease.
6. Verify remote commit identity and absence of unwanted attribution.
7. Delete the temporary bundle and local rewrite backup refs.

### Task 6: Update GitHub Metadata And Verify Deployment

**Steps:**

1. Set the repository description and homepage URL.
2. Confirm the GitHub Actions deployment completes successfully.
3. Confirm the public app responds and the remote repository metadata is correct.
