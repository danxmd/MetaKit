# Proposal

## Why

Work package 8.2 in `docs/phase-8.md`: Git mode needs GitHub and GitLab from the browser, with tokens kept only in that browser.

## What Changes

- `packages/storage`: `GitHubRemote` and `GitLabRemote` implementing the `GitRemote` interface (ADR 0007), one commit for all changed files, rejected non-fast-forward updates detected, branch and tag listing.
- A token store in IndexedDB (add, test, remove), GitLab sign-in with OAuth PKCE or a personal access token.
- `packages/ui`: a Git settings page (add, test, remove tokens; choose repository, folder and branch).

## Capabilities

### New Capabilities

- `git-hosting`

## Impact

- No file format changes. Tokens never leave IndexedDB (architecture rule 9). GitLab OAuth needs an application registered by Danial; the steps are in `docs/git-oauth-setup.md`.
