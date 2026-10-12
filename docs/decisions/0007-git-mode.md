# ADR 0007: Git mode for Kits

Status: proposed (Danial to review)

## Context

Kit builders want history, branches, reviews and releases for Kits. Models stay in synced folders. The phase 0 git spike (`docs/spikes/git.md`) showed that GitLab accepts browser requests and that GitHub's REST API is documented to; the real GitHub and write paths still need Danial's run.

## Decisions

1. **REST, not Git.** The app talks to the GitHub and GitLab REST APIs from the browser. No proxy, no server (architecture rule 1). If GitHub turns out to block browser calls, the fallback needs a new ADR.
2. **One interface.** `GitRemote` (`packages/storage/src/git/remote.ts`) is the only thing the layout, merge and UI know about hosting. The adapters implement it; tests use an in-memory remote.
3. **A Git Kit is a normal workspace Kit plus a link.** Opening from Git imports the layout into the workspace; a `GitLink` (repo, folder, branch, base commit, base files) lives in IndexedDB of that browser. Pending changes are the difference between the Kit and the base files.
4. **Pull merges per file, then per field**, three-way against the base. Same-field clashes ask the person. The result is applied as Kit commands in one undo step, so the usual sync and undo apply.
5. **Tokens only in IndexedDB**, never in the workspace, repository, logs or tests (rule 9). Errors pass through a redactor.
6. **Layout is a second representation of the Kit format**, with the format version in `tool.json`; Kit migrations apply on read.
7. **Releases** are repository tags; a tag opens as a read-only Kit version.

## Consequences

- Several people can work in one workspace on a Git Kit; the link and commit rights are per browser.
- Scripts and assets live in the repository as separate files.
- Real-service behaviour (GitHub CORS, exact error texts) is confirmed by Danial's run of the spike protocol and the phase 8 test protocol.
