# ADR 0003: one instance id per browser tab

Status: accepted (phase 3). Closes the risk "one instance id per browser profile, not per tab" from the phase 0 report.

## Context

Change files are named by instance and are write-once. Two tabs of one browser profile that share an instance id would write the same file names, and the second write would be refused or, worse, interleave sequences. Presence and clash detection also assume one writer per id.

## Decision

An instance is a tab. The id (8 hex digits) is made when the tab first needs it and kept in `sessionStorage`, so a reload keeps it and a new tab gets a new one. The display name and colour are per browser profile (IndexedDB), so the same person is recognisable in every tab. The id is not a secret and never leaves the folder.

When a tab closes, it flushes and folds its change files into its snapshot when it can. Leftover folders of closed tabs are harmless: their files are read like any other, and their snapshots carry everything.

## Consequences

- No lock between tabs is needed.
- A person with two tabs open on the same document appears twice in presence.
- Attribution is per tab, not per person, as the plan says ("attribution, not security").

## Alternatives considered

- One id per profile with a lock between tabs (Web Locks): a second tab could not edit, or would have to take over.
- A random id per page load: every reload would leave another folder behind.
