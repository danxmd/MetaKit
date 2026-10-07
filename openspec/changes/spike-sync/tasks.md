# Tasks

## 1. Spike package and merge module

- [x] 1.1 Create `spikes/sync` as a private workspace package with a Vite page; verify it serves with `pnpm --filter @metakit-app/spike-sync dev` and `pnpm typecheck`, `pnpm lint` still pass.
- [x] 1.2 Add the hybrid logical clock with unit tests; verify monotonic advance on local and remote operations and tie-breaking by instance ID.
- [x] 1.3 Add the pure merge module (last writer wins per field, tombstones); verify unit tests for commutativity, associativity, idempotence and tombstone wins over concurrent edits.
- [x] 1.4 Add fast-check property tests with several simulated instances, random delivery order, duplicates and snapshot splits; verify all instances end in identical states over at least 1,000 runs.

## 2. Folder storage

- [x] 2.1 Add folder picking with the handle and instance ID kept in IndexedDB, and workspace creation with one model; verify in Chromium that the handle survives a reload.
- [x] 2.2 Add write-once change files flushed at most every 2 seconds, and snapshots that remove this instance's folded-in files; verify with a Playwright test that files appear, are never rewritten, and shrink after a snapshot.
- [x] 2.3 Add presence files refreshed every 10 seconds and change detection with FileSystemObserver and a 2-second scan fallback; verify with a Playwright test using two pages on one local folder.

## 3. UI and two-window check

- [x] 3.1 Add the minimal UI (boxes with editable `x`, `y`, `name`, who is present, "last change from X, N s ago"); verify visually and by Playwright.
- [x] 3.2 Verify two browser windows on one machine stay in sync through a local folder after concurrent edits of different and the same fields.

## 4. Protocol and report

- [x] 4.1 Write `docs/spikes/sync.md` with the test protocol for Danial (OneDrive, SharePoint through OneDrive, Google Drive for desktop, Dropbox; two machines each), the results table, and what the property tests do and do not prove; verify every step is concrete enough to follow without asking.

## 5. Integration

- [ ] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` on a clean checkout and record results in the PR description.

## Workflow follow-up

- Danial runs the protocol on two real machines over the four services and fills in the results table.
- Danial approves the pull request; archive the change after merge (`/opsx:archive`).
