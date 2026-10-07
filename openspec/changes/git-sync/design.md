# Design

- A `GitLink` per tool library per browser: `{ toolSlug, service, host, repo, folder, branch, baseCommit, baseFiles }` in IndexedDB. The base files are the layout at the last pull or push.
- Pending changes = layout of the current tool library compared with `baseFiles`; no separate pending store.
- Pull: fetch the head layout (theirs), take `baseFiles` (base) and the current layout (ours). Merge per file, then per JSON field path. Same field changed to different values on both sides is a conflict; the UI asks which side to keep. The merged tool library is turned into tool commands (`putClass`, `removeClass`, ...) by diffing it with the current one.
- Commit: refuse while a pull is needed (`NonFastForwardError`); send changed files as one commit; update the link to the new commit.
- Releases: tags of the repository are listed; a tag opens as a read-only version a model can follow, recorded as `toolVersion` on the manifest of models.
