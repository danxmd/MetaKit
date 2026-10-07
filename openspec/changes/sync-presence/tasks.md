# Tasks

## 1. Service

- [ ] 1.1 Presence file format and reader/writer with the partial-file rule and format version; verify with tests including a newer version.
- [ ] 1.2 Presence service with refresh timer, stale detection, divergence check and `whoIsEditing`; verify with a fake clock.

## 2. App

- [ ] 2.1 Profile (name, colour) in IndexedDB, first-visit dialog, per-tab instance id.
- [ ] 2.2 Sync session in the controller: open model through the session, change detection, close.
- [ ] 2.3 Avatars, remote selections on the canvas, soft edit warning, divergence warning.

## 3. Tests

- [ ] 3.1 Playwright: two windows on one folder show each other's edits, selections and presence.
