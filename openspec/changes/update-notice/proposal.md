# Proposal

## Why

People who run MetaKit from a download or a clone (`start.cmd`, `./start.sh`, `pnpm start`) keep the version they got, and nothing tells them when a newer one is out (issue #49). The copy on GitHub Pages is always the newest, but a local copy can stay months behind. The app also has no version number, so nobody can say which one they run.

## What Changes

**A version**
- The app gets a real version, `0.1.0`, in the root `package.json` and `apps/web/package.json`. Vite puts it into the build (`__METAKIT_VERSION__`).
- The footer of the Start, Models and Kits pages reads "MetaKit 0.1.0 is free and open source."

**The update notice**
- When MetaKit opens, it asks GitHub for the latest release of `danxmd/MetaKit` (`GET https://api.github.com/repos/danxmd/MetaKit/releases/latest`, no sign-in). Drafts and pre-releases do not count. The tag `v0.2.0` is read as `0.2.0`.
- If that release is newer than this copy, a notice says: "MetaKit 0.2.0 is available (you have 0.1.0)." It says how to update (run `git pull` and start again, or download the new zip), links to the release page in a new tab, and has **Dismiss**.
- The notice is on the Start page and, once a workspace is open, as a thin strip under the top bar.
- **Dismiss** hides it for that version. A later release shows it again.
- MetaKit asks at most once a day and remembers the answer in local storage, with the last check time and the dismissed version.
- The copy on GitHub Pages (a host ending in `github.io`) does not ask.
- Offline, a rate limit, an error answer or bad JSON show nothing; only a debug line is logged.

**Releasing**
- `README.md` gets "Releasing a new version" (bump the version, tag `vX.Y.Z`, create a GitHub Release) and "Updating" for people who run a local copy. No workflow publishes anything by itself.

**Documentation**
- New topic "Update notice". Updated: Start page, Models page, Kits page (footer) and "No server, your files stay yours".
- ADR 0015 records why a read-only call to GitHub's public API does not break rule 1.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-app-shell`: adds the app version and the update notice.

## Impact

- **Code:** `packages/ui/src/shell/update-check.ts` (new, pure logic with injected fetch, clock and storage), `components/UpdateNotice.svelte` (new), `StartPage.svelte`, `SupportFooter.svelte`; `apps/web/src/App.svelte`, `access.ts` and `vite.config.ts`.
- **Tests:** unit tests for the version compare, GitHub's answer and the once-a-day memory; e2e tests through a new `latestRelease` test hook, so no test calls GitHub.
- **Network:** one automatic GET to `api.github.com` a day, from local copies only. It sends nothing beyond the request itself.
- **No file format, command or storage change** in the workspace. **No new dependency.**
- **Bundle:** about 1 KiB gzip at start-up.
