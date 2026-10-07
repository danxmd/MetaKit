# Design

- Port `spikes/git/src/{github,gitlab,http,pkce,redact}.ts` into `packages/storage/src/git/`, adapting them to `GitRemote` (`packages/storage/src/git/remote.ts`). Spike code is copied only through this reviewed change; `spikes/` stays untouched.
- GitHub: `git/trees/<sha>?recursive=1`, blobs, a tree on the base tree, a commit, and a ref update with `force: false`; status 422 mentioning "fast forward" becomes `NonFastForwardError`.
- GitLab: tree read across pages (`X-Next-Page`) limited to the tool library's folder; one commit with actions; `last_commit_id` per updated or deleted file; `start_sha`/`parent` to detect a moved branch.
- Tokens: `TokenStore` over IndexedDB (key-value helper already in `browser-state.ts`), records `{ service, host, label, token, createdAt }`. Nothing is logged; errors pass through the `Redactor`.
- Tests run against local stand-in servers (as in the spike) and a fake `fetch`; no real service in CI.
