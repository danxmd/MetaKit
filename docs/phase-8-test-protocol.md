# Phase 8 test protocol: Git mode on real services

For Danial. Run this once the GitHub and GitLab adapters, the token settings page and the Git dialogs are wired into the app. It confirms what the automated tests cannot: the real services, real tokens and the feel of the dialogs. The automated tests use an in-memory remote that behaves like a real one (commit ids, branches, tags, refused stale commits); this protocol checks the same behaviour against GitHub and GitLab.

Do the whole protocol once for GitHub and once for GitLab. Use throwaway repositories and tokens that you delete afterwards. Never paste a token into an issue, a chat or a file in the repository; if one is shown anywhere in the app, that is a bug (rule 9).

## What you need

- Chrome or Edge on a desktop, and a second browser profile (or a private window) to act as the second writer. Firefox and Safari should also open Git mode, so try step 1 in one of them too.
- A throwaway repository on each service, created with a README so it has a first commit:
  - GitHub: `your-name/metakit-git-test`, with a fine-grained personal access token limited to that repository, permission **Contents: read and write**.
  - GitLab: `your-name/metakit-git-test`, with a personal access token with scope `api` (or the OAuth sign-in once the application is registered).
- A workspace folder with the sample Kit `bpmn-lite` (add it from `kits/bpmn-lite/kit.json` through Add on the Kits page).

## 1. Link and first push

1. Add the token in the settings page and press Test. Expected: a short message with the repository name; the token itself is never shown again.
2. Link the Kit `bpmn-lite` to the empty repository, folder `bpmn-lite`, branch `main`.
3. Open Commit and push. Expected: the list shows every part as added (Kit settings, classes, relation classes, model types, shapes, panel layouts) with plain-English lines such as `Class "Task" added`. The message box is filled with a suggestion. Commit.
4. On the service, look at the repository. Expected: one new commit with your message and these files under `bpmn-lite/`: `tool.json`, `classes/task.json` and the other classes, `relations/`, `model-types/`, `shapes/`, `panels/`. Open `classes/task.json`: the id is inside the file, the JSON has 2-space indent and ends with a new line.
5. Open Commit and push again. Expected: it says nothing has changed and the button is disabled.

## 2. A change from each side, merged

Browser A is your normal profile. Browser B is the second profile with its own workspace; open the Kit from Git there (Open from Git, same repository, folder and branch).

1. In B, rename the label of the class `Task` to `Work item` and commit with the message `B: relabel Task`.
2. In A, without pulling, change a shape of the Kit (for example the fill colour of the Task shape) and open Commit and push. Expected: the list shows `Shape "..." changed`, nothing else. Press Commit. Expected: it is refused with the message that the branch has changed and you must pull first. Nothing is pushed. On the service the history still ends with B's commit.
3. In A press Pull. Expected: no question is asked, because the two changes touch different parts. Both changes are now in A: the new label and the new shape.
4. In A open the undo history. Expected: the pull is one entry; Undo returns the Kit to how it was before the pull, and Redo brings the pull back.
5. In A commit with the message `A: new shape colour`. In B pull. Expected: B has both changes and no question.

## 3. A clash in the same field

1. In A change the label of the attribute `Name` of `Task` to `Title (A)`. Do not commit.
2. In B change the same label to `Title (B)` and commit.
3. In A press Pull. Expected: a dialog titled "Both sides changed the same thing" lists exactly one clash, `Class "Task": attributes > ... > labels > en`, with your value (`Title (A)`) on the left under **Keep mine** and the other value (`Title (B)`) on the right under **Take theirs**. Apply choices stays disabled until you choose.
4. Choose **Take theirs** and apply. Expected: the label is `Title (B)` in A. Commit and push. On the service, the file `classes/task.json` has `Title (B)`.
5. Repeat steps 1 to 3 with a different value and choose **Keep mine**. Expected: A keeps its value, and after Commit the service has it.
6. Variation: in A delete the class `Gateway`; in B change its label and commit; pull in A. Expected: one clash that says the class was removed on one side and changed on the other, with "(not there)" shown for the removed side.

## 4. Releases

1. On the service tag the current commit `v1.0.0` (GitHub: Releases, Draft a new release, choose a new tag; GitLab: Code, Tags, New tag). Change something in A, commit, and tag `v1.1.0`.
2. In A open the version picker. Expected: `v1.1.0` is listed first, then `v1.0.0`, each with a short commit id. A repository without tags shows a sentence that explains how to make one.
3. Pick `v1.0.0` and open it. Expected: the Kit opens as the old version (read only, not linked for editing), without the change from step 1. The working copy is unchanged.
4. Create a model that follows `v1.0.0` and check that its manifest records the Kit version (once the lead has wired this; if not yet, skip).

## 5. Errors

Check that each message is plain English and contains no token:

- Remove the token in settings, then press Pull. Expected: a message that the access is missing, with a link to the settings.
- Use a token without write permission and press Commit. Expected: a message that the token cannot write to this repository.
- Delete the branch on the service and press Pull. Expected: a message that the branch does not exist.
- Take the network offline and press Pull. Expected: a message that the service cannot be reached; nothing in the Kit changes.

## What to report

For every step that did not match: service, step number, what you saw, the exact message text, and a screenshot of the dialog. Also report anything slow (a commit or pull over about 3 seconds for a Kit of this size) and any place where the wording confused you. Remember to delete the throwaway repositories and revoke the tokens.
