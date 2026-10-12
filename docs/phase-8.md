# Phase 8: Git mode (lane A, weeks 15 to 17)

Phase 8 lets a Kit live in a GitHub or GitLab repository, so Kit builders get history, branches, reviews and releases. Models stay in synced folders. Git mode works in every modern browser, including Firefox and Safari.

**Before starting:** read `docs/spikes/git.md`. Plan section: "Collaboration through a shared folder", Git mode.

## 8.1 One-file-per-part layout (`packages/storage`)

Deliver:

- The layout from the plan: `tool.json`, `classes/<key>.json`, `relations/`, `model-types/`, `shapes/`, `panels/`, `rules/`, `scripts/<name>.ts`, `assets/`.
- Conversion both ways between this layout and the internal Kit.
- Stored JSON with stable key order, so diffs show only real changes.

Done when: a Kit round-trips through the layout without any diff.

## 8.2 GitHub and GitLab adapters (`packages/storage`)

Deliver:

- **GitHub:** fine-grained personal access token; read the tree; one commit for all changed files through blobs, trees, commits and refs; detect a rejected non-fast-forward update.
- **GitLab:** sign-in with OAuth PKCE or a personal access token; one commit through commit actions with `last_commit_id`.
- Tokens kept only in IndexedDB; a settings page to add, test and remove them.
- Branch selection when opening a repository.

Done when: both services complete a multi-file commit from the browser. GitLab OAuth needs an application registered on GitLab; Claude writes the steps and Danial registers it.

## 8.3 Commit, pull and merge (`packages/ui`, `packages/sync`)

Deliver:

- Local pending changes kept in IndexedDB until **Commit and push**, with a commit message and a list of changed parts.
- **Pull**: three-way merge field by field against the common base version; only same-field clashes ask the user to choose, side by side.
- Tagged releases offered as Kit versions that models can follow.

Done when: a Kit round-trips through GitHub and GitLab, with a change merged from each side and one same-field clash resolved in the UI.

## Out of scope

Git mode for models (follow-up question 23), branches and pull requests inside the app (they stay on GitHub or GitLab).
