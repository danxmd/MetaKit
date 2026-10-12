# Phase 3 test protocol: two machines over a synced folder

Danial runs this on two real machines. Claude cannot: it needs real OneDrive and SharePoint clients. Run the whole table once for a OneDrive folder and once for a SharePoint library synced with the OneDrive client. Add Google Drive and Dropbox later if wanted.

## Setup

1. Machine A and machine B: Chrome or Edge on desktop, the same synced folder, "Always keep on this device" set for it.
2. Open the app on both and choose the folder. The first visit asks for a name and colour: use "Anna" on A and "Ben" on B.
3. On A: add a Kit, create a model "Sync test" and place five elements. Wait until B shows the model in the explorer; open it on B.
4. Note the time sync takes (it is shown by the status line) so slow sync is not mistaken for a bug.

## Tests

For each row write what happened in the "Result" column (OK, or what was wrong) and attach the sync client's name for that run.

| #   | Do                                                                       | Expect                                                                                                         | Result |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | A moves element 1.                                                       | B shows it moved within the sync delay; status line on B says "last change from Anna".                         |        |
| 2   | A and B each move a different element at the same time.                  | Both moves are on both machines. Nothing lost.                                                                 |        |
| 3   | A and B each edit a different attribute of one element.                  | Both edits are on both machines.                                                                               |        |
| 4   | A and B both rename element 2 within a few seconds.                      | One name wins on both machines (same on both). The loser sees a small notice that a change was replaced.       |        |
| 5   | A deletes element 3 while B edits it.                                    | Element 3 is gone on both. No error.                                                                           |        |
| 6   | A selects element 4.                                                     | B shows a coloured outline with Anna's name. A's avatar shows in B's top bar.                                  |        |
| 7   | A starts editing an attribute of element 4 that B also has open.         | B sees a soft warning that Anna is editing it.                                                                 |        |
| 8   | A presses Ctrl+Z after B changed the same field.                         | A's undo leaves B's value alone; the notice says one change was skipped.                                       |        |
| 9   | Pause sync on B (or go offline), make 5 edits on A and 5 on B, resume.   | Everything merges, no change lost; no "diverged" warning once both are up to date.                             |        |
| 10  | Close the model on A, wait, open it on B.                                | State is identical (compare element positions). Snapshot appears in `_state/<A>/snapshot.json`.                |        |
| 11  | Delete the model on A. Check B. Restore it from "Deleted" on B.          | It leaves B's list and comes back on restore with all content. After 30 days it would stay hidden.             |        |
| 12  | Same as 11 for a Kit.                                                    | Same.                                                                                                          |        |
| 13  | Set the folder to "Free up space" (online-only) and open the workspace.  | The folder health check warns that files are not available on this device.                                     |        |
| 14  | Make a conflicted copy by editing the same file from both sides offline. | Health check names the conflicted-copy file. MetaKit's own files never produce one (each writes only its own). |        |
| 15  | Edit continuously on both for 10 minutes.                                | No error notices; status line stays current; both machines end with the same hash (no divergence warning).     |        |

## What to report

- Rows that failed, with the sync client, the time between the change and its appearance, and a screenshot of the status line.
- Any file under `_state/` that the sync client renamed or duplicated.
- Whether sync delays were short enough to feel usable.

Phase 3 is done when no row loses a change on both OneDrive and SharePoint.
