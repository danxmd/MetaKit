# ADR 0015: The update check against GitHub Releases

Status: accepted (design chosen by Danial, 2026-10-19; confirmed in the pull request review)

## Context

Issue #49: people who run MetaKit from a download or a clone should hear when a newer version is out. The app had no version number at all. Danial chose GitHub Releases as the source of truth (OpenSpec change `update-notice`).

Rule 1 says there is no server and that storage calls go straight from the browser to the folder or service. The Start page says MetaKit "uploads nothing anywhere". An automatic call to the network on open needs a written reason.

## Decision

1. **A version.** The app's version is the `version` of `apps/web/package.json` (and of the root `package.json`, kept equal), starting at `0.1.0`. Vite's `define` puts it into the build as `__METAKIT_VERSION__`. The footer shows it.
2. **The source.** On open, the app reads `GET https://api.github.com/repos/danxmd/MetaKit/releases/latest`. This endpoint leaves out drafts and pre-releases. The tag (`v0.2.0`) gives the version, and `html_url` the link; a link outside `https://github.com/` is ignored. Versions are compared as three numbers by a small function of our own, with no new dependency.
3. **Why rule 1 holds.** There is still no MetaKit server. The call is a read-only, unauthenticated request to GitHub's public API, like loading the app from GitHub Pages. It sends no token, no workspace content, no name or profile: only what any browser request carries (IP address, user agent, `Origin`). GitHub's answer is not stored anywhere but this browser's local storage. "Uploads nothing anywhere" stays true: nothing of the person's is sent.
4. **Once a day.** The time of the last check, the last release seen and the dismissed version are kept in local storage (`metakit.updateCheck`), like other interface choices. A check, even a failed one, is not repeated within 24 hours, so opening MetaKit often never meets GitHub's limit of 60 unauthenticated requests an hour. In between, the remembered release is used, so the notice stays until it is dismissed or MetaKit is updated.
5. **Local copies only.** The copy on GitHub Pages is always the newest, so a host ending in `github.io` does not check. The signal is the hostname at run time, not `BASE_PATH` at build time: the e2e tests also build with `BASE_PATH=/MetaKit/`, and someone may host a copy under a sub-path that does lag behind.
6. **Quiet failure.** Offline, a rate limit, a non-200 answer or bad JSON show nothing; a single `console.debug` line is written.
7. **Tests never call GitHub.** The `latestRelease` hook of `window.__METAKIT_TEST__` replaces the request. When the test seam is present without that hook, the answer is "no release", so no e2e test calls GitHub.
8. **Releases are made by hand.** Bump the version, tag `vX.Y.Z`, push the tag and create a GitHub Release from it (README, "Releasing a new version"). No workflow publishes a release by itself.

## Consequences

- Local copies make one GET to `api.github.com` a day. Someone on a network that blocks GitHub simply never sees the notice.
- Until the first GitHub Release exists, the endpoint answers 404 and nothing is shown.
- A release whose tag is not a version (`nightly`) is ignored. The version in `package.json` must match the tag, or the notice would show to people already on the release.
- No workspace file, command or format changes.
