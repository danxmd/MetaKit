---
id: git-commit
title: Commit
category: teamwork
summary: The Commit and push dialog, which sends all changed parts of a Kit to the repository as one commit.
keywords: [commit and push, commit dialog, commit message, pending changes, non-fast-forward, push changes]
contexts: [git.commit]
order: 170
---

A commit is a saved step in the history of the repository. In MetaKit you commit the changes you made to a Git Kit with one button. The commit goes straight to the branch on GitHub or GitLab.

## What it is

When you edit a Git Kit in Build mode, nothing is sent until you commit. MetaKit compares the Kit with the *base*, the state at your last pull or commit. The difference is your pending changes. The button **Commit and push** shows how many parts changed, for example **Commit and push (3)**.

A commit is made in one go. All changed files are sent as one commit on the branch of your link. If the branch moved on since you last pulled, the commit is refused and nothing changes. This protects other people's work.

Only the files of the layout are compared: `kit.json`, the folders of the parts and `assets/`. In a repository from before the Kit rename, the first commit also renames `tool.json` to `kit.json`. A `README.md` or other files in the repository are never touched. See [[git-layout]].

## Where to find it

In Build mode, top bar, on a Kit with a Git link: **Commit and push**. It opens the dialog **Commit and push**. The context for this page is the dialog.

## How to use it

1. Press **Commit and push**. The dialog lists your changes.
2. Check the list. Each line says what happened to which part.
3. Edit the **Message**. It already holds a suggestion. Say what you changed, and why.
4. Press **Commit and push**. The button reads **Committing...** while it works.
5. The dialog closes. Under the bar you read `Committed 3 files.`
6. If an error appears in the dialog, read it. For the most common one, press **Cancel**, press **Pull**, and try again.

## Every option explained

### The list of changes

Changes are grouped under **Added**, **Changed** and **Removed**. A line looks like these:

- `Class "Task" changed (attributes, labels)`
- `Rule "Needs an owner" added`
- `Script "Check pipeline" changed`
- `Kit settings changed (settings)`
- `Asset "logo.png" added`

The words in brackets are the fields that differ. An empty list says "Nothing has changed since the last pull or commit." and the count above reads "No changes". Otherwise the count reads, for example, "3 changed parts".

### The message

The suggestion is built from the first change: `Change class Task and 2 more parts`. Replace it with something useful. A message that is empty is not accepted: the button stays off, and its tooltip says "Write a short message that says what you changed."

### Buttons

| Button | What it does |
| --- | --- |
| **Cancel** | Closes the dialog. Nothing is sent. Disabled while committing. |
| **Commit and push** | Sends the commit. Disabled when there is no change, no message, or a commit is running. |

### Errors you may see

| Message | Cause and fix |
| --- | --- |
| `The branch has changed since you last pulled. Pull first, then commit again.` | Someone else committed to the branch. Press **Pull** first. |
| `There is no GitHub token for github.com in this browser. Add one in the Git settings.` | The token was removed. Add one. |
| `The token cannot write to this repository.` | The token is read only. Make one with write rights. See [[git-tokens]]. |
| `The token was refused. It may be wrong, expired or revoked.` | Replace the token. |
| `There is nothing to commit: nothing has changed since the last pull or commit.` | Nothing differs from the base. |
| `Could not reach GitHub...` | Connection problem. |

## Examples

- You add a class "Risk" with three attributes, a shape and a rule. **Commit and push (3)** lists `Class "Risk" added`, `Shape "Risk box" added`, `Rule "Risk needs an owner" added`. One commit with the message "Add Risk class, shape and rule".
- You rename an attribute key. Rules and shapes that used it are updated together. The list shows each changed part. See [[keys-and-renaming]].

## Good to know

- **Who is the author.** The commit is made with your token, so the service shows the token's owner as the author.
- **One commit, many files.** GitHub gets the files as a tree, GitLab as one multi-file commit. Either way the history shows one commit.
- **After success.** Your base moves to the new commit. The pending count goes to zero.
- **Undo does not undo a commit.** After a commit, **Undo** in Build mode changes the Kit again and creates new pending changes.
- **A release in view.** If you opened a release (see [[git-releases]]), committing writes that state to the branch. The note says so: "Commit to keep it on the branch, or undo."
- **Review.** Branches and pull requests are done on the hosting service. MetaKit commits to the branch of the link.

## Related

[[git-mode]] · [[git-pull-conflicts]] · [[git-releases]] · [[git-tokens]] · [[git-layout]] · [[troubleshooting]]
