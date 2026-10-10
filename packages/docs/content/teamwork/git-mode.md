---
id: git-mode
title: Git mode
category: teamwork
summary: Keep a Kit in a GitHub or GitLab repository, with commits, pulls and tagged versions, straight from the browser.
keywords: [git mode, open from git, git link, github, gitlab, repository, kit in git]
contexts: [settings.git]
order: 150
---

Git mode lets a team keep a Kit in a Git repository on GitHub or GitLab. You get history, review and versions. Models stay in the shared folder and are not part of this.

## What it is

A Git Kit is a normal Kit in your workspace plus a **link** to a repository. The link says which repository, which folder inside it, which branch, and what the repository looked like at your last pull or commit (the *base*). The link is stored in your browser only. Whatever differs from the base is your set of pending changes.

How it works:

- **No server.** MetaKit talks to the GitHub or GitLab web interface (REST) straight from your browser. Nothing runs in between.
- **One file per part.** The repository holds `kit.json` plus one file per class, relation class, model type, shape, panel layout, rule and script. This keeps changes by different people in different files. See [[git-layout]].
- **Commit and push in one step.** **Commit and push** sends all changed parts as one commit. See [[git-commit]].
- **Pull merges.** **Pull** merges the branch into your Kit field by field. Only a field that both sides changed asks you. See [[git-pull-conflicts]].
- **Versions are tags.** **Releases** lists tags of the repository and switches the Kit to one. See [[git-releases]].
- **Tokens stay here.** A token is the key MetaKit uses. It is kept in your browser's database and nowhere else. See [[git-tokens]].

Each person who works on the Kit has their own token, link and rights. The Kit in the workspace is shared through folder sync like any other (see [[sync-overview]]), so a colleague sees the changes you pulled, but they need their own link to commit.

## Where to find it

- **Open from Git** on the Models page opens the **Git settings** page. See [[page-models]].
- In Build mode, a Kit with a link shows in the top bar: the label `owner/name · branch`, then **Commit and push**, **Pull** and **Releases**. See [[page-build-view]].
- Messages from Git appear in a line under that bar.

## How to use it

### First time

1. Make a token on GitHub or GitLab with the right to read and write the one repository. Steps are in [[git-tokens]].
2. In MetaKit press **Open from Git**.
3. Under **Add a token** choose the **Service**, check the **Address of the service**, give the token a **Name for this token**, paste the **Token** and press **Save token**.
4. Under **Choose the Kit** pick the token, type the **Repository** (`owner/name`, or the full path on GitLab), and the **Folder in the repository** if the Kit is not at the root.
5. Press **Test the token**. A good answer reads `owner/name, can write. Branch main has 12 files in the repository root.`
6. Pick the **Branch**. Press **Use this Kit**.
7. MetaKit reads the repository, adds the Kit to your workspace, saves the link, and opens it in Build mode.

### Every day

1. Edit the Kit in Build mode as always.
2. Press **Commit and push**. The number in brackets shows how many parts changed.
3. Before a longer session, press **Pull** to get others' work.
4. To use a published version, press **Releases**.

## Every option explained

### Saved tokens

| Part | Meaning |
| --- | --- |
| Name, `GitHub · github.com` | The token's name and where it works. The secret is never shown. |
| **Rename** | Changes the name. |
| **Remove** | Asks first: **Remove it** or **Keep it**. |
| Notice | "Tokens stay in this browser only. They are never written to your workspace folder or to the repository, and they are not sent anywhere except to GitHub or GitLab." |

### Add a token

| Field | Meaning |
| --- | --- |
| **Service** | GitHub or GitLab. Choosing one fills the default address (`github.com` or `gitlab.com`). |
| **Address of the service** | Change it for a self-managed GitLab. No spaces. |
| **Name for this token** | For example "Work laptop". |
| **Token** | Hidden while typing. Pasting it is the only time you see it. |
| **Save token** | Problems: `Paste the token first.`, `Enter the address of the service.`, `The address of the service cannot contain spaces.` |

### Choose the Kit

| Field | Meaning |
| --- | --- |
| **Token** | Which saved token to use. |
| **Repository** | `owner/name` on GitHub, `group/project` (any depth) on GitLab. You may paste the address of the repository page or its clone address. MetaKit cleans it. |
| **Folder in the repository** | Empty means the root. |
| **Test the token** | Contacts the service, lists branches and counts files. |
| **Branch** | The default branch comes first. |
| **Use this Kit** | Enabled after a good test. |

### In Build mode

| Control | What it does |
| --- | --- |
| `owner/name · branch` | The linked repository. |
| **Commit and push (n)** | See [[git-commit]]. |
| **Pull** | See [[git-pull-conflicts]]. Disabled while a Git action runs. |
| **Releases** | See [[git-releases]]. |

Notes under the bar: `Committed 3 files.`, `Already up to date.`, `Pulled the changes from the repository.`, `Pulled the changes and kept your choices.`, `Now showing release v1.0.0. Commit to keep it on the branch, or undo.`

## Examples

- A team of three keeps `acme/method-tools` with the folder `bpmn-lite`. Anna creates a class. She presses **Commit and push** with the message "Add class Risk". Ben presses **Pull** and gets the class.
- Anna and Ben both rename the same attribute. Ben's pull shows **Both sides changed the same thing**. He chooses **Keep mine** or **Take theirs**.
- The team tags `v1.2.0`. A modeller presses **Releases** and opens that version to read it.

## Good to know

- **Errors in plain words.** `The token was refused. It may be wrong, expired or revoked.`; `The token cannot read this repository.`; `The token cannot write to this repository.`; `The repository was not found or the token cannot see it.`; `GitHub is limiting requests. Wait a minute and try again.`; `Could not reach GitHub. Check the address and your connection; the service may also refuse requests from a browser.` See [[troubleshooting]].
- **Repository limits.** GitHub lists a repository in one answer; `The repository is too large for GitHub to list in one answer. Use a smaller repository for the Kit.` Use a repository just for Kits.
- **Wrong folder.** `This folder does not hold a Kit: kit.json is missing.` Check the folder.
- **Older repository.** A repository written before the Kit rename has `tool.json`. It opens as usual, and your next commit renames it to `kit.json` (see [[git-layout]]).
- **Assets.** Images in `assets/` come with the Kit. Build mode does not edit them in Git mode.
- **Opening twice.** MetaKit does not check whether the repository is already in your workspace. Open it once.
- **GitLab sign-in.** The code for signing in to GitLab (OAuth) exists, but the app does not show it yet. Use a personal access token.
- **Real services.** The tests use in-memory stand-ins for GitHub and GitLab. The checks against the real services are listed in `docs/git-oauth-setup.md` and are run by Danial.
- **Models are not in Git.** Only the Kit. Share models through the folder (see [[sync-overview]]) or export them (see [[import-export]]).

## Related

[[git-tokens]] · [[git-commit]] · [[git-pull-conflicts]] · [[git-releases]] · [[git-layout]] · [[concepts-kit]] · [[concepts-no-server]]
