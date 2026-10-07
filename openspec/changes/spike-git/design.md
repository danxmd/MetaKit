# Design

## Context

Plan sections "Collaboration" (Git mode) and the tech-stack table fix the approach: REST APIs called from the browser, no proxy, tokens only in the browser (see `docs/implementation-plan.md`). Spike code lives in `spikes/git/`.

## Goals / Non-Goals

**Goals:** show in a real browser what each service allows; show one multi-file commit and conflict detection per service; keep tokens out of everything.

**Non-Goals:** the Git mode file layout, pull and field-level merge, token storage in IndexedDB, GitHub Enterprise or self-hosted GitLab.

## Decisions

**D1. Plain `fetch`, no Git library.** The clients are thin and take an injected `fetch`, so the same code runs in the page and in Node tests. isomorphic-git behind a proxy is the plan's fallback.

**D2. One token header for both services.** `Authorization: Bearer <token>` works for GitHub tokens and, per GitLab's documentation, for personal and OAuth tokens. GitLab's preflight also allows `private-token`, so that header is a fallback.

**D3. Throwaway branch for every write.** The full check creates `metakit-spike/<id>` from the chosen branch, works there, and deletes it. The base branch is never written.

**D4. Conflict demo.** GitHub: two writers build commits on the same base; the first moves the ref, the second's non-force update must be refused with 422. GitLab: an update that carries a stale `last_commit_id` must be refused, and nothing else in the same commit may be applied.

**D5. Tokens only in memory.** The token field is a password input, never stored; every logged line passes through a redactor that hides the typed token and token-shaped strings; the PKCE verifier and state may use session storage because they are single use, the access token never does.

**D6. Local stand-ins, labelled as such.** Node servers that follow the documented endpoints and error shapes let the clients, flows and page be tested here, including real cross-origin behaviour in Chromium. They are not evidence of the real services; the real run is.

**D7. Real, token-free evidence where possible.** A manual Playwright run calls the real gitlab.com public API from Chromium (CORS, headers, pagination, token endpoint).

## Risks / Trade-offs

- [GitHub is unreachable from the build environment] → protocol for Danial; a result of "blocked by CORS" is a valid finding and needs an ADR.
- [Stand-ins drift from the real services] → the real run prints the services' own error texts; the clients match loosely.
- [GitLab error wording is unverified] → recorded as an open item in the report.
