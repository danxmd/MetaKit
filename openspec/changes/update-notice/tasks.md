# Tasks

## 1. Version and check (`feat/update-notice`)

- [x] 1.1 Version `0.1.0` in the root `package.json` and `apps/web/package.json`; `__METAKIT_VERSION__` defined in `apps/web/vite.config.ts`.
- [x] 1.2 `update-check.ts`: version parse and compare, GitHub's answer, once-a-day memory, dismiss, the GitHub Pages rule. Unit tests.
- [x] 1.3 `UpdateNotice.svelte`, on the Start page and under the top bar; the version in `SupportFooter.svelte`.
- [x] 1.4 `latestRelease` test hook in `access.ts`; under the test seam GitHub is never asked. `prepare()` answers "no release" by default.
- [x] 1.5 E2E: the footer version; a newer release shows the notice and its link; the notice under the top bar; Dismiss survives a reload; the same or an older version shows nothing.
- [x] 1.6 ADR 0015.
- [x] 1.7 Docs: new `pages/update-notice.md`; update `page-start`, `page-models`, `page-kits` and `concepts-no-server`.
- [x] 1.8 README: "Updating" and "Releasing a new version".
- [x] 1.9 `pnpm build` size before and after, in the PR description.

## 2. Needs Danial

- [ ] 2.1 Create the first GitHub Release (`v0.1.0`) once this is merged, so later releases have something to compare with.
- [ ] 2.2 Judge the look of the notice on the Start page and under the top bar.
