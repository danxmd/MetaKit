# Design

- **Presence file.** `{formatVersion: 1, instance, name, colour, at, document: {kind, slug} | null, selection: string[], hash, seen}`, written with `overwrite` every 10 seconds and when the selection or the open document changes (at most once per second). `seen` maps instances to the highest change-file sequence read; `hash` is a 53-bit text hash of the canonical merged state.
- **Reading.** The service lists `_presence/`, reads every file (partial files are retried), and treats a file older than 30 seconds as gone. It reports `People` (everyone but this instance) to the UI.
- **Divergence.** Two presence files for the same document with equal `seen` (and equal snapshots, which `seen` includes) but different hashes are reported as a divergence, naming both instances. Different `seen` means they have not read the same files yet, which is normal.
- **Edit warnings.** `editingItem` in presence names the item a person has in an editor (a script or rule once those exist). `whoIsEditing(people, document, item)` tells the UI to show a soft warning before another person edits it.
- **Display name and colour.** Asked for once in a small dialog at the first visit, stored in IndexedDB (profile-wide, not secret); a colour is suggested from a fixed palette.
- **Per-tab instance.** `getTabInstanceId()` keeps the id in `sessionStorage` (ADR 0003).
- **Canvas.** The active layer draws other people's selected elements in their colour with their initials; avatars sit in the model toolbar.
- **Change detection.** The app subscribes `adapter.watch` on the document folder; each callback triggers `session.rescan()` (debounced to 200 ms); the adapter already falls back to a 2-second scan.
