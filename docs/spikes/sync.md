# Spike 0.3: folder storage and merge

Status: code and automated checks done; the real-service runs need Danial (see "Test protocol").

Code: `spikes/sync/`. Spec: `openspec/changes/spike-sync/`. Not imported by `packages/` or `apps/`.

## What was built

- A pure merge module (`src/merge.ts`): last writer wins per element field, tombstones for deletes, ordered by a hybrid logical clock (`src/clock.ts`) with the instance ID breaking exact ties.
- Folder storage (`src/workspace.ts`):
  - the folder handle and the instance ID live only in IndexedDB;
  - write-once change files `_state/<instance>/<sequence>.jsonl`, flushed at most 2 s after an edit;
  - `_state/<instance>/snapshot.json`, which folds in everything read and removes this instance's own folded change files;
  - `_presence/<instance>.json`, refreshed every 10 s;
  - change detection with `FileSystemObserver`, and a 2 s scan where it is missing (plus a 10 s safety scan when the observer is present).
- A minimal page: boxes with editable `x`, `y` and `name`, who is present, "Last change from X, N s ago".

## What the automated checks prove

| Check | Result |
| --- | --- |
| Merge unit tests (`merge.test.ts`, `clock.test.ts`) | 9 pass: highest clock wins per field, different fields both survive, exact-tie break by instance ID, tombstone beats a later edit, idempotent and non-mutating, clock never goes backwards |
| Property test: random edits on 2 to 4 simulated instances with clock skew, delivered in random orders with random duplicates | 1,000 runs, all instances end in identical states |
| Property test: each instance folds a random prefix of its log into a snapshot; a reader merges snapshots and leftover files in random order | 1,000 runs, always equals the state from the full log |
| Property test: merging two states is commutative | 300 runs pass |
| Two windows, one folder (Playwright, Chromium, origin private file system standing in for a picked folder) | Edits flow both ways; different fields both survive; later edit to the same field wins; delete propagates; change files are never rewritten; a snapshot leaves only `snapshot.json` and a third instance that only has the snapshot reaches the same state; presence shows the other person |

## What it does not prove

- Behaviour over a real sync client. The browser only ever sees a local folder, and the whole risk is in how OneDrive, Google Drive for desktop and Dropbox fill it. The protocol below measures that.
- `showDirectoryPicker` itself. Playwright cannot drive the native folder dialog, so the automated checks use the origin private file system, which has the same handle API. Picking a real folder, remembering it across reloads and `requestPermission` need a person (step 1 of the protocol).
- Two windows of one browser profile share one IndexedDB, hence one instance ID. The automated checks override the ID with `?instance=`. In real use, one browser profile is one instance, as in the plan. Two profiles or two machines are separate instances.

## Findings while building

1. **A new file is visible before its content is.** Creating a file and then writing it are two steps, so a reader can list a change file that is still empty. The first version parsed an empty file as "zero changes" and marked it read, so the change was lost until restart. Readers now accept a change file only if it ends in a newline, and otherwise retry on the next scan. `stats.partialReads` counts these; the protocol asks you to note it. Real sync clients are likely to expose files half-copied too, so this rule belongs in phase 3.
2. **Files that are rewritten (`snapshot.json`, presence) can also be read half-written.** Both are parsed defensively and retried on the next scan.
3. **`FileSystemObserver` exists in the Chromium used here (141)**, including for the origin private file system. Whether it reports files that a sync client writes into a real folder is part of the protocol (step 4).
4. **The clock counter is 4 digits**, enough for the spike (a tie within one millisecond needs 10,000 edits). Phase 3 should decide the production width.

## Test protocol for Danial

You need two machines (A and B), each with Chrome or Edge on desktop and the same sync account. Allow about 20 minutes per service, so about 80 minutes in all.

### Setup (once per machine)

1. In a terminal in the repository: `pnpm install`, then `pnpm --filter @metakit-app/spike-sync dev`. The page is at `http://localhost:4175/`.
   - Alternative without installing: build once (`pnpm --filter @metakit-app/spike-sync build`) and serve `spikes/sync/dist` with any static server.
2. Note each machine's clock error: open `https://time.is` and write down the offset in seconds.

### Run, once per service

Services: **OneDrive**, **a SharePoint document library synced through OneDrive**, **Google Drive for desktop**, **Dropbox**.

1. **Pick the folder (machine A).** Create an empty folder `metakit-spike` inside the synced location. In the page press **Pick folder** and choose it. Allow edit access. Expected: the page shows "You: User xxxx" and the mode line says which change detection is in use. Reload the page and press **Reopen last folder**; expected: it reopens without asking you to pick again. Write down whether Chrome asked for permission again.
2. **Wait for sync.** Wait until the sync client shows the folder as synced on machine B. Note whether files show as "online only" or as a cloud placeholder (OneDrive "Files On-Demand", Google Drive "stream files"). If they do, set the folder to **always keep on this device** and repeat the step; write down that this was needed.
3. **Open the folder (machine B).** In the page press **Pick folder** and choose the same folder as synced on B. Expected: after a few seconds each page lists the other under "Present".
4. **Latency, A to B (5 times).** On A press **Add box** and note the time. On B note when the box appears (a stopwatch is enough). Write each time in the table. Also note whether the mode line on B says `FileSystemObserver` or `2 s scan`, and whether the box appeared quicker than the scan interval would explain.
5. **Latency, B to A (5 times).** Same in the other direction, editing `x` of an existing box.
6. **Concurrent edits.** On A set box 1 `x` to 100. On B, within 2 seconds, set box 1 `y` to 200. Expected: after both arrive, both machines show x=100 and y=200. Then on A set `name` to "from A" and 1 second later on B set it to "from B". Expected: both end with "from B" (the later edit wins). Write down anything else.
7. **Offline then reconnect.** Pause sync on B (the sync client menu). Make 3 edits on B and 3 on A. Resume sync on B. Expected: after sync, both machines show the same boxes and values. Write down how long this took.
8. **Anomalies.** Open the synced folder in the file explorer. Look for: files named with "conflicted copy", "(1)", the machine name, or a `~` or `.tmp` suffix; zero-byte files; files that stay as placeholders; edits that reached the other side only after you restarted the page. Write down what you find, and the final `partialReads` count: open the browser console on each machine and type `__sync.stats`.
9. **Snapshot.** In the console on A type `await __sync.snapshot()`. Expected: after sync, `_state/<A's id>/` holds only `snapshot.json`, and B still shows all boxes. Reload B; expected: the same boxes.

### Results table

Copy this table into this file, one row per service and machine pair.

| Service | Machines (OS, browser) | Online-only files? | A to B latency, s (5 runs) | B to A latency, s (5 runs) | Observer or scan | Concurrent edits correct? | Offline merge correct? | `partialReads` A / B | Anomalies (conflicted copies, zero-byte files, ...) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OneDrive | | | | | | | | | |
| SharePoint via OneDrive | | | | | | | | | |
| Google Drive for desktop | | | | | | | | | |
| Dropbox | | | | | | | | | |

### What decides go or plan B

- **Go** if for every service: latency stays under about 15 s, concurrent and offline edits merge correctly, and no conflicted copies appear. Online-only files are acceptable if a setup check can detect them.
- **Plan B** if a service creates conflicted copies of write-once files, loses changes, or takes more than a minute regularly. The plan's fallbacks are in `docs/implementation-plan.md` (Collaboration section, Options considered).
