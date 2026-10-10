# Proposal

## Why

Work package 3.4 in `docs/phase-3.md`: people need to see that sync is working, learn when a clash was resolved, restore what was deleted, and be warned when the folder is not set up for sync. The two-machine test over OneDrive and a SharePoint library needs a protocol and a results table.

## What Changes

- A sync status line ("last change from Anna, 12 s ago", pending, errors), a small notice when a same-field clash was resolved, a 30-day trash for deleted models and Kits with restore, and a folder health check (online-only, unreadable, partial or conflicted-copy files).
- The test protocol and results table for Danial's OneDrive and SharePoint runs.

## Capabilities

### New Capabilities

- `sync-status`: status line, clash notice, trash and folder health.

## Impact

- Trash markers gain Kits and an expiry rule (30 days); format version 1 of the marker is unchanged because the new data is a new field. Depends on `sync-core` and `sync-presence`. The two-machine test is Danial's.
