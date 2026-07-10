# FrameWave Identity, Guidance, And Maintainability Design

## Goal

Make FrameWave consistently credit VictorInFocus, remove unwanted AI co-author attribution from the repository and its public history, improve in-product guidance, and complete a conservative maintainability cleanup without changing export or organization behavior.

## Identity

- Use `VictorInFocus` for the creator credit in the app, README, and license.
- Centralize app-level creator links and display identity in a small brand module.
- Configure future commits with the GitHub-linked VictorInFocus identity.
- Remove obsolete local assistant configuration and its ignore rule.
- Remove unwanted AI co-author trailers from public commit messages.
- Rewrite historic creator credits and commit authorship to the GitHub-linked VictorInFocus identity.
- Update GitHub repository description and homepage metadata.

## History Safety

The public-history cleanup changes every commit hash on `main` and requires a force-push.

Before rewriting:

- Require a clean worktree.
- Confirm local `main` matches `origin/main`.
- Create a temporary repository bundle outside the worktree.

During rewriting:

- Preserve commit order and dates.
- Replace historic creator display credits with VictorInFocus.
- Remove obsolete assistant ignore entries from historic trees.
- Remove unwanted AI co-author trailers from commit messages.
- Map author and committer identity to `VictorInFocus <192429617+victor-in-focus@users.noreply.github.com>`.

After rewriting:

- Verify the working tree, file history, and commit messages no longer contain the removed attribution or former personal-name credit.
- Force-push with an explicit lease against the previously observed remote commit.
- Verify GitHub resolves new commits to the `victor-in-focus` account.
- Remove the temporary local bundle only after the remote verification succeeds.

## Interface Guidance

Placeholders should explain the expected shape of an answer without becoming instructions inside the interface.

- Character name: `e.g. Mara Quinn`
- Take or descriptor: `e.g. Scene 04 pickup`
- Tags: `e.g. character-a, final, close-up`
- Library search: `Search names, filenames, or tags`
- Import tags: `e.g. imported, archive`
- Inline tag editing: `Add tags, separated by commas`
- Project name: `e.g. Midnight Train`
- Folder name: `e.g. Pickups`

Icon controls should pair their existing accessible names with concise sighted-user tooltips. Tooltips should describe the action, not the icon:

- Create project
- Expand or collapse project sidebar
- Add, replace, or remove thumbnail
- Star or unstar reference
- Download reference MP4
- Edit reference tags
- Move to project or folder
- Delete reference
- Preview or stop selected voice
- Set voice start or end
- Add an existing reference MP4
- Download saved references as a ZIP

## Maintainability Cleanup

This pass stays low risk:

- Centralize app identity constants.
- Avoid recalculating the same limited tag set multiple times for every rendered library row.
- Add contract tests for identity, placeholders, and important tooltips.

The audit identifies two larger follow-up refactors, but they are deliberately excluded from this change:

- Split the 2,442-line `App.tsx` into composer, library, and workspace orchestration units.
- Consolidate the 3,096-line stylesheet so responsive rules remain but superseded design layers and repeated selectors are removed.

Those changes should be separate because their regression surface is much larger than copy and metadata cleanup.

## Verification

- Run the focused identity and render tests through a red-green cycle.
- Run all tests and the production build after tracked changes.
- Verify dependency audit remains clear.
- Inspect desktop and mobile placeholders and tooltips in the browser.
- Verify local and remote history after the force-push.
