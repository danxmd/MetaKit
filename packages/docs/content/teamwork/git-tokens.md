---
id: git-tokens
title: Tokens and security
category: teamwork
summary: How to make a narrow access token for GitHub or GitLab, where MetaKit keeps it, and how it is protected.
keywords: [personal access token, fine-grained token, token store, test the token, git token, access token, pkce sign-in]
contexts: []
order: 160
---

A token is a long secret text that proves to GitHub or GitLab that MetaKit may act for you on one repository. It replaces a password. Treat it like one.

## What it is

MetaKit has no accounts and no server (see [[concepts-no-server]]). To read and write your repository, your browser sends your token directly to GitHub or GitLab. The rules for tokens are strict:

- **Stored in your browser only.** Tokens live in IndexedDB of your browser profile, under the key `gitTokens`. They are never written to the workspace folder, the repository, a model, a tool library, a log or a test file.
- **Shown once.** After you save a token, the screen shows only its name and where it works. The secret is not shown again.
- **Sent only in one header.** The token goes in the `Authorization` header of requests to the service you chose, and nowhere else.
- **Cleaned from messages.** Every error text passes a filter that replaces the token, and anything shaped like a GitHub or GitLab token, with `[token hidden]`.
- **Per browser.** A token on your laptop does not exist on your desktop. Each browser needs its own.

> **Warning:** Anyone who can run code in your browser page could read the token while the page is open. Use a token with the narrowest rights, with an expiry date, and remove it when you no longer need it.

## Where to find it

Models page, **Open from Git**, then the **Git settings** page. The sections are **Saved tokens**, **Add a token** and **Choose the tool library**. See [[git-mode]].

## How to use it

### GitHub: a fine-grained token

Make one token per person and per repository.

1. On GitHub open Settings, Developer settings, Personal access tokens, **Fine-grained tokens**, **Generate new token**.
2. Token name: for example `MetaKit tool library`. Resource owner: the account or organisation that owns the repository. Expiration: 30 to 90 days.
3. Repository access: **Only select repositories**. Choose the one repository.
4. Permissions, Repository permissions: **Contents: Read and write**. (**Metadata: Read** is added for you.) Leave everything else on "No access".
5. Generate the token and copy it. You see it only once.
6. In MetaKit choose the service **GitHub**, paste the token, name it and press **Save token**.

The repository needs at least one commit, for example a README. If your organisation requires approval for fine-grained tokens, an owner must approve it first.

### GitLab: a personal access token

1. In GitLab open your avatar, Preferences, **Access tokens**, **Add new token**.
2. Name it `MetaKit tool library`. Expiry: within 90 days. Scope: **api**. GitLab has no narrower scope that can commit. Your role on the project must be Developer or higher.
3. In MetaKit choose **GitLab**. For a self-managed GitLab, change the **Address of the service**.

### Test it

Under **Choose the tool library** pick the token, type the repository and press **Test the token**. You should read `owner/name, can write`.

## Every option explained

### What the test says

| Result | Meaning |
| --- | --- |
| `owner/name, can write` | The token can read and commit. |
| `owner/name, read only, the token cannot commit` | The token has no write right. You can open and pull but not commit. |
| `owner/name, write access not confirmed` | The service did not say. Try a commit later to find out. |
| `The token was refused. It may be wrong, expired or revoked.` | Wrong, expired or revoked token. |
| `The repository was not found or the token cannot see it.` | The name is wrong, or the token has no access to that repository. |
| `The token cannot read this repository.` | Missing read right. |
| `GitHub is limiting requests. Wait a minute and try again.` | Rate limit. |
| `Could not reach GitHub...` | No connection, a wrong address, or the service refused a browser request. |

### Which token is used

A link stores the repository, not the token. For a commit or a pull, MetaKit takes the first saved token for the same service and address. If you keep two GitHub tokens, the older one is used. Remove tokens you do not need, or keep one per service.

### Removing a token

**Remove** on the token asks for confirmation (**Remove it** or **Keep it**). This removes it from your browser only. To really end its power, also revoke it on GitHub or GitLab.

### Signing in to GitLab (not in the app yet)

The package contains the code for a GitLab sign-in without a stored secret (OAuth with PKCE). It needs an application registered by the project owner, and it is not offered on any screen today. Such tokens would last two hours and would not be refreshed. The instructions for the owner are in `docs/git-oauth-setup.md`.

## Examples

- A contractor gets a token valid for 30 days on one repository. When it expires, MetaKit shows `The token was refused. It may be wrong, expired or revoked.` The contractor makes a new token and replaces the saved one.
- You use a work laptop and a home computer. You make two tokens, one for each, with the names "Work laptop" and "Home".

## Good to know

- **Clearing site data removes tokens.** If you clear the data of MetaKit in the browser, or use a private window, your tokens are gone and you add them again. See [[script-permissions]] for other things kept in the browser.
- **Do not paste tokens into rules, scripts, models or chat.** A tool library is shared in the folder and in Git.
- **Revoke after leaving a team.** Revoking on GitHub or GitLab is the only way to be sure.
- **Not tested on the real services.** The checks against github.com and gitlab.com, including browser access, are written in `docs/git-oauth-setup.md` and are run by the project owner.
- **Troubleshooting.** See [[troubleshooting]].

## Related

[[git-mode]] · [[git-commit]] · [[git-pull-conflicts]] · [[concepts-no-server]] · [[assistant-privacy]] · [[troubleshooting]]
