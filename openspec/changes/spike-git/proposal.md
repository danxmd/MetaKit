# Proposal

## Why

Git mode for Kits (phase 8) assumes that a static page in a browser can read a repository tree and write a multi-file commit through the GitHub and GitLab REST APIs with no proxy, and detect conflicts. Whether each service allows this from a browser is unverified, and GitLab's browser access with tokens is unverified in the plan. Work package 0.5 in `docs/phase-0.md` tests it before anything depends on it.

## What Changes

- Add `spikes/git/` (experiment code, never imported by `packages/` or `apps/`):
  - a GitHub client: fine-grained token, read a tree, one commit from many files through blobs, tree, commit and ref, and detection of a rejected non-fast-forward update;
  - a GitLab client: personal access token or OAuth with PKCE, one commit from many actions through commit actions guarded by `last_commit_id`;
  - a CORS check for both, in a real browser;
  - a page to run the checks against a throwaway repository, with the token typed in at runtime and kept in memory only.
- Add `docs/spikes/git.md` with results, findings, and the steps for Danial's run with real tokens.

Tokens are never committed, logged or written to a fixture (rule 9). The tests use clearly fake tokens and local stand-ins for the services.

## Capabilities

### New Capabilities

None. A spike produces evidence and a report. This change sets `skip_specs: true`; acceptance criteria are in `tasks.md`, from `docs/phase-0.md`.

### Modified Capabilities

None.

## Impact

- New files under `spikes/git/` and `docs/spikes/git.md`. No new dependencies.
- Needs Danial: throwaway GitHub and GitLab repositories, one token each, and (optionally) a GitLab OAuth application. The work environment cannot reach `api.github.com`, so GitHub results come only from his run.
- Depends on 0.1. Part of the single phase-0 pull request at Danial's request.
