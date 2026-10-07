# Tasks

## 1. Clients

- [x] 1.1 Add the GitHub client (read tree, branch, multi-file commit, conflict detection); verify unit tests against a stand-in, including a refused non-fast-forward update that leaves the branch untouched.
- [x] 1.2 Add the GitLab client (paginated tree, last commit id, multi-file commit with actions); verify unit tests, including a stale `last_commit_id` that applies nothing.
- [x] 1.3 Add OAuth with PKCE; verify the RFC 7636 example vector and a full exchange against a stand-in with no client secret sent.
- [x] 1.4 Add the redactor; verify typed and token-shaped strings are hidden and ordinary text is not.

## 2. Page and browser checks

- [x] 2.1 Add the page (CORS check, read tree, full check on a throwaway branch, PKCE sign-in); verify in Chromium against stand-ins that the token never appears in the page, URLs, bodies or storage.
- [x] 2.2 Verify in Chromium that a server without CORS headers is reported as blocked, and that the PKCE round trip works through a redirect.
- [x] 2.3 Run the token-free live check against gitlab.com in a real browser; verify the numbers in the report come from that run.

## 3. Report

- [x] 3.1 Write `docs/spikes/git.md` with results, findings and step-by-step instructions for Danial's run on GitHub and GitLab; verify every step names exactly what to click, what to expect, and what to clean up.

## 4. Integration

- [ ] 4.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`; record results in the pull request.

## Workflow follow-up

- Danial runs the real checks with tokens and fills in the results table; he reviews and merges; archive the change after merge (`/opsx:archive`).
