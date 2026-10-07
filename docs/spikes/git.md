# Spike 0.5: Git hosting APIs from the browser

Status: code and automated checks done; **GitLab browser access is verified against the real gitlab.com; GitHub and the write paths of both services still need Danial's run** with throwaway repositories and his own tokens (see "Run it yourself"). No token was used, written or logged in this work.

Code: `spikes/git/`. Spec: `openspec/changes/spike-git/`. Not imported by `packages/` or `apps/`.

## Verdict so far

- **GitLab from the browser: very likely go.** A real Chromium page calling the real gitlab.com was allowed to send an `Authorization` header, could read error responses, could read the pagination headers, and could call the OAuth token endpoint. What is not yet shown on the real service is the commit itself, because that needs a token.
- **GitHub from the browser: not yet verified.** The container this work ran in blocks every call to `api.github.com` (even a plain preflight returns the proxy's own 405 and 403). GitHub's documentation says the REST API accepts browser requests; the plan relies on this. Only your run can confirm it.
- **The code is ready for both.** The clients, the flows and the page pass against local stand-ins that follow the documented endpoints. These stand-ins are not evidence of how the real services answer.

## What was built

- `GitHubClient`: fine-grained token in the `Authorization` header; read a tree (`git/trees/<sha>?recursive=1`); create a branch; one commit from many files (blobs, then a tree on top of the base tree, then a commit, then a ref update with `force: false`); deletes by `sha: null`; a rejected non-fast-forward update becomes `NonFastForwardError`.
- `GitLabClient`: read a tree across pages (`X-Next-Page`); read a file's `last_commit_id`; create a branch; one commit from many actions (`create`, `update`, `delete`) with `last_commit_id` on updates and deletes; a stale update becomes `StaleFileError`.
- OAuth with PKCE for GitLab (`pkce.ts`): verifier, S256 challenge, authorize URL, code exchange as a public client with no secret.
- A page that runs the checks: browser access (CORS), read the tree, and a full check on a throwaway branch named `metakit-spike/<id>` that is deleted at the end.
- A `Redactor` that hides the typed token and anything shaped like a GitHub or GitLab token from everything shown.

## What was verified

### On the real gitlab.com (read-only, no token)

From a real Chromium page on `http://localhost:4177`, run by `pnpm --filter @metakit-app/spike-git exec playwright test -c playwright.live.config.ts`:

| Check | Result |
| --- | --- |
| Call `/api/v4/projects/<id>` with an `Authorization` header (forces a preflight) | allowed; the page read the 401 status and body; headers it could read: `cache-control, content-length, content-type, x-request-id` |
| Call `POST /oauth/token` with a form body | allowed; the page read the 401 `invalid_client` answer |
| Read the tree of `gitlab-org/gitlab-foss` with no token | allowed; the client followed `X-Next-Page` through 5 pages, 500 entries |

From `curl` with an `Origin` header, the preflight answers are:

| Endpoint | Allowed origin | Allowed headers | Allowed methods |
| --- | --- | --- | --- |
| `/api/v4/...` (including `/repository/commits`) | `*` | `authorization`, `content-type`, `private-token` (they echo what is asked) | GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS |
| `/oauth/token` | `*` | `content-type` only | POST, OPTIONS |

The API also exposes `X-Next-Page`, `X-Total`, `X-Total-Pages`, `Link`, `ETag` and `X-Gitlab-Last-Commit-Id` to the page, and sends `Access-Control-Allow-Origin: *` on error responses too, so a rejected token produces a readable message and not a blank CORS failure.

### Against local stand-ins (Node, and Chromium with real cross-origin rules)

| Check | Result |
| --- | --- |
| GitHub: read tree; one commit of 3 files (one in a subfolder); a second commit that updates, deletes and adds; read back | pass |
| GitHub: a second writer commits on the same base; the first writer's update is refused as not a fast-forward and the branch keeps the other writer's commit | pass |
| GitHub: work on a throwaway branch and leave `main` untouched | pass |
| GitLab: read a tree across 3 pages; one commit of several actions; update and delete guarded by `last_commit_id` | pass |
| GitLab: a stale `last_commit_id` is refused and **nothing** from the same commit is applied | pass |
| PKCE: the RFC 7636 example vector; a wrong verifier is refused; the right one gets a token; no client secret is sent | pass |
| The token appears only in the `Authorization` header: never in a URL, a request body, the page text, the log, or browser storage; reloading forgets it | pass |
| In Chromium, calls to a server without CORS headers are blocked, and the page says "CORS or the address is unreachable" | pass |
| In Chromium, the full PKCE round trip through a redirect and back, then using the new token | pass |

## Findings

1. **GitLab's OAuth token endpoint only allows the `content-type` request header and the POST method.** A form-encoded exchange with no other custom headers works, which is what the client sends. Nothing else may be added to that request.
2. **GitLab guards updates per file, not per branch.** `last_commit_id` goes on each `update` or `delete` action; there is no single "branch moved" check on the commit call. The client reads the file's `last_commit_id` first (the response header `X-Gitlab-Last-Commit-Id` is exposed to browsers). A pull with field-level merge in phase 8 needs the last commit id of every file it touches, or the commit id of the branch head when the user last pulled.
3. **GitLab tree reading is offset-paginated and slow for big repositories.** `gitlab-org/gitlab-foss` has 87,831 entries, 879 pages of 100. A tool library is small, but phase 8 should read one folder at a time or use keyset pagination (`pagination=keyset`, answered through the `Link` header) for anything large. A recursive listing also starts with directories, so the first 500 entries contained no files.
4. **GitHub needs a repository with at least one commit.** The Git data API fails on an empty repository (known behaviour; not verified here). Create the test repository with a README.
5. **GitHub trees can come back truncated** for very large repositories (`truncated: true`). The client reports it. Tool libraries are far below the limit.
6. **A browser cannot tell "blocked by CORS" from "unreachable".** Both are a `TypeError`. The page says so and suggests the likeliest reason.
7. **The error text from the real services decides two things I could only guess:** the exact words of GitLab's stale-file error, and that GitHub answers an update that is not a fast-forward with status 422 and a message containing "fast forward". The client matches loosely on both. The full check prints the real text; send it back so the match can be made exact.

## Run it yourself (needs Danial)

You need one throwaway repository on each service, each with at least a README on `main`. Use new, empty accounts or repositories you can delete afterwards.

### GitHub

1. Create a repository, for example `metakit-spike-test`, and let GitHub add a README.
2. Create a **fine-grained personal access token**: Settings, Developer settings, Personal access tokens, Fine-grained tokens. Resource owner: you. Repository access: **only** the test repository. Permissions: **Contents: Read and write** (Metadata: Read is added automatically). Expiry: 7 days.
3. In the repository: `pnpm install`, then `pnpm --filter @metakit-app/spike-git dev` and open `http://localhost:4177/` in Chrome.
4. Service **GitHub**, repository `your-name/metakit-spike-test`, branch `main`, paste the token.
5. Press **1. Check browser access**. Expected: "The browser could call …". If it says "could NOT call", that is a finding: copy the text, note the browser, and stop here.
6. Press **2. Read the tree**. Expected: 1 file.
7. Press **3. Run the full check**. Expected: every line starts with `ok`, the line `stale update is refused: 422: …` shows GitHub's real wording, and the last lines say `cleaned up: deleted branch …` and `Result: ALL STEPS PASSED`.
8. Copy the whole log into the results table below. Delete the token (Settings, Developer settings) and the repository.

### GitLab

1. Create a project, for example `metakit-spike-test`, with a README (initialise with a README).
2. Create a **personal access token**: Preferences, Access tokens. Scope **api**, expiry 7 days, role on the project Developer or above.
3. Same page as above. Service **GitLab**, repository `your-group/metakit-spike-test` (the full path), branch `main`, paste the token.
4. Press **1**, **2**, **3** as above. In step 3, GitLab's real text for the stale update appears on the line `stale update is refused: 400: …`.
5. **Sign in with PKCE (optional, about 5 minutes):** in GitLab, User settings, Applications, add a new application. Name `metakit-spike`, Redirect URI `http://localhost:4177/`, **untick Confidential**, tick scope **api**. Save and copy the **Application ID** (not the secret; there is none to use). Clear the token field, paste the Application ID into the OAuth field, press **GitLab: sign in with PKCE**, sign in and approve. Expected: you return to the page and it says "Signed in." Then press **2** and **3**; they should work with the token from the sign-in. Delete the application afterwards.
6. Copy the log into the table. Delete the token, the application and the project.

### Results (to fill in)

| Service | Browser | Browser access OK? | Tree read | Full check | Real stale-update text | PKCE sign-in | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GitHub | | | | | | not applicable | |
| GitLab (token) | | | | | | | |
| GitLab (PKCE) | | | | | | | |

### If something fails

- **GitHub is blocked by CORS:** the plan's fallback is `isomorphic-git` behind a small CORS proxy, which breaks the "no server" rule and needs an ADR before anything is built. Before that, try a different browser profile without extensions, and the deployed Pages address instead of `localhost`.
- **GitLab sign-in fails:** use the personal access token path; Git mode then asks the user to paste a token, as it does for GitHub.
- **A step fails with a message from the service:** copy it as it is; it decides what the client should match on.

## What this spike leaves open

- Git mode's file layout, pull and field-level merge, and token storage in IndexedDB (phases 8 and 1).
- Rate limits and secondary rate limits on GitHub with many files in one commit (the check uses 3 to 6 files).
- Binary files (the clients send text) and files larger than the services allow through the JSON APIs.
- GitHub Enterprise and self-hosted GitLab: the base address is a field, but their CORS settings are an administrator's choice and were not examined.
