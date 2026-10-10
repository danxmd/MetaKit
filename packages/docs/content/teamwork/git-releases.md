---
id: git-releases
title: Releases
category: teamwork
summary: The Kit versions dialog, which lists the tags of the repository and shows the Kit as it was at one of them.
keywords: [releases, kit versions, git tag, tagged version, open this version, release picker]
contexts: [git.releases]
order: 190
---

A release is a version of the Kit that your team has named, for example `v1.2.0`. In Git it is a *tag*: a name stuck on one commit. MetaKit lists the tags and lets you look at the Kit as it was at one of them.

## What it is

Tags are made on GitHub or GitLab. MetaKit does not create them. Teams usually tag a commit when a version of the modelling method is ready for use.

The dialog **Kit versions** reads the tags and lets you choose one. Choosing a version replaces the contents of your open Kit with that version, as one ordinary step in the undo list. The link to the repository stays on your branch.

This is useful for three things: to read an older version, to compare it with the present, or to roll the Kit back to that state and commit the result.

## Where to find it

In Build mode, on a Kit with a Git link, press **Releases** in the top bar. See [[page-build-view]]. The dialog opens when the tags are loaded.

## How to use it

1. Press **Releases**. The buttons wait while the tags load.
2. Read the list. Each line shows the tag and the start of its commit id, such as `v1.2.0 (commit 3fa9c1b)`.
3. Choose one with its round button.
4. Press **Open this version**. The button reads **Opening...** while it works.
5. The dialog closes. Under the bar you read `Now showing release v1.2.0. Commit to keep it on the branch, or undo.`
6. Look around. To go back, press **Undo** in Build mode. To keep the version on the branch, press **Commit and push**. See [[git-commit]].

## Every option explained

| Part | Meaning |
| --- | --- |
| Title | **Kit versions** |
| Intro | "A version is a tag of the repository. Pick one to open that version of the Kit to read or to follow." |
| List | The tags. If every tag looks like a version number (`1.2.3` or `v1.2.3`, with optional extras), they are sorted with the newest first. Otherwise the order is the service's order. |
| Empty list | "This repository has no tags yet. Tag a commit on GitHub or GitLab (for example v1.0.0) to publish a version of the Kit." |
| **Cancel** | Closes the dialog and changes nothing. |
| **Open this version** | Needs a choice. Applies the version. |

### What "open" does

MetaKit reads the files of the folder at that tag, builds the Kit from them and compares it with your open one. The difference is applied as Kit commands in one batch. Things in your Kit that are not in the version are removed. Things in the version that you do not have are added.

> **Warning:** Uncommitted work that is not in the version is removed from the open Kit by this. **Undo** brings it back as long as you stay in Build mode. If you are unsure, commit first.

Because the link still points to your branch, the count on **Commit and push** now shows the differences between the version and the branch.

### Errors

| Message | Cause |
| --- | --- |
| `The Kit at "v9" cannot be read: ...` | The tagged commit has a broken or missing `tool.json` or part file. |
| `This Kit is not linked to a repository.` | The Kit has no link, so there is nothing to ask. |
| `The token cannot read this repository.` and others | See [[git-tokens]]. |

## Examples

- The team tags `v1.0.0` after the first workshop. A year later `v2.0.0` changes a class. A consultant who needs the old rules presses **Releases**, opens `v1.0.0`, copies what she needs, then presses **Undo**.
- A method engineer finds a bad change in the current branch. He opens the last good tag, checks it, and commits to put the branch back to that state.

## Good to know

- **Read, then decide.** Looking at a version is an edit like any other until you commit. Models opened in another window of the workspace see the same Kit, since it is shared through the folder. Do not leave the Kit in an old version for long when others work with it.
- **Only layout files count.** A tag with only a README gives the error above.
- **Models.** Releases are of Kits only. They do not change models.
- **Format versions.** A version written by an older MetaKit is brought up to date in memory. A version from a newer MetaKit is refused. See [[format-versions]].
- **Make tags on the service.** On GitHub: Releases or git tag. On GitLab: Repository, Tags.

## Related

[[git-mode]] · [[git-commit]] · [[git-pull-conflicts]] · [[git-layout]] · [[history]] · [[kit-settings]]
