# Git mode: tokens, GitLab sign-in and the real-service check

Work package 8.2 (ADR 0007). Claude has not registered anything and has not used a real token or written to github.com or gitlab.com. These steps are for Danial.

MetaKit talks to GitHub and GitLab straight from the browser. A token is the key it uses. Tokens stay in IndexedDB of the browser profile and are never written to the workspace folder or the repository.

## 1. GitHub: a fine-grained token

Use one token per person and per repository, as narrow as possible.

1. Open GitHub, then Settings, Developer settings, Personal access tokens, **Fine-grained tokens**, **Generate new token**.
2. Token name: `MetaKit Git mode`. Resource owner: the account or organisation that owns the repository. Expiration: 30 to 90 days.
3. Repository access: **Only select repositories**, and pick the one repository that holds the Kit.
4. Permissions, Repository permissions: **Contents: Read and write**. (**Metadata: Read** is added automatically.) Leave everything else on "No access".
5. Generate the token and copy it once.
6. In MetaKit, open Git settings, choose service **GitHub**, paste the token, give it a name and save. Then enter `owner/name`, the folder of the Kit (empty for the root) and press **Test the token**. The page should say `owner/name, can write`.

The repository needs at least one commit (create it with a README). If the organisation requires approval for fine-grained tokens, an owner has to approve it before it works.

## 2. GitLab: a personal access token (works today)

1. GitLab, your avatar, **Preferences**, **Access tokens**, **Add new token**.
2. Name `MetaKit Git mode`, expiry within 90 days, scope **api** (GitLab has no narrower scope that can commit). The role on the project must be Developer or higher.
3. Paste it into Git settings with service **GitLab**. For a self-managed GitLab, change the address of the service.

## 3. GitLab: sign in with OAuth (PKCE)

This needs an application registered on GitLab. It is a public client: there is no client secret, and the browser proves itself with a one-time verifier (PKCE).

1. On gitlab.com: your avatar, **Preferences**, **Applications**, **Add new application**. (For a group or an instance, use the group's Settings, Applications, or Admin area, Applications.)
2. **Name:** `MetaKit`.
3. **Redirect URI:** one address per line:

   ```text
   https://danxmd.github.io/MetaKit/
   http://localhost:5173/MetaKit/
   ```

   The trailing slash matters; GitLab compares the address exactly.

4. **Confidential:** untick it. A confidential application expects a secret, which a browser app cannot keep.
5. **Scopes:** tick **api** only.
6. Save. Copy the **Application ID**. It is not a secret; it goes into the app as the client id. Do not copy or use the "Secret" shown for a confidential application (there is none for a public one).
7. Give Claude (or whoever wires the app) the Application ID. It is passed to `beginGitLabSignIn({ clientId, redirectUri })`; it is not hard coded in the package.

Notes:

- GitLab access tokens from this sign-in last two hours. The first version does not refresh them: sign in again when GitLab says the token was refused.
- For a self-managed GitLab, register the application there and use that address as the host.

## 4. Real-service check

Needs a throwaway repository on each service (with a README on `main`) and a token with the rights above. Delete the tokens and repositories afterwards.

What to verify, and what to write down:

1. **GitHub CORS.** From Chrome on the Pages address (and from `localhost`), in Git settings press **Test the token** for the GitHub repository. Expected: `owner/name, can write` and a branch list. If the page says "Could not reach GitHub", open the browser console, Network tab, and note whether the preflight to `api.github.com` failed. This is the open question from spike 0.5. If GitHub blocks browser calls, stop: the fallback needs a new ADR.
2. **A multi-file commit on each service.** Through the app (or the phase 8.3 commit screen once it exists) commit one changed file, one new file in a subfolder and one deleted file. Expected: exactly one new commit on the branch, listing those three changes.
3. **Real error text for a stale update.**
   - GitHub: make a commit from MetaKit, then make another commit on the same branch (edit a file in the GitHub web editor), then commit again from MetaKit without pulling. The adapter should say the branch has changed. Note GitHub's exact `422` message (the adapter matches `fast forward`).
   - GitLab: the same. The adapter compares the branch head first, so the likely message comes from the head check and not from GitLab. To see GitLab's own text, send two commits close together. Note the status and message (the adapter matches `changed since`, `last_commit_id`, `has changed`, `already exists`, `doesn't exist`).
4. **Token refused, repository not found, no write rights.** Test with a revoked token, a mistyped repository and a read-only token. Expected texts: "The token was refused…", "The repository was not found or the token cannot see it.", "The token cannot write to this repository."
5. **GitLab pagination header.** Read a folder with more than 100 files. Expected: all files listed (the adapter follows `X-Next-Page`).
6. **GitLab HEAD on a file.** The adapter reads `X-Gitlab-Last-Commit-Id` from a `HEAD` request. Confirm in the Network tab that the browser can read the header (CORS exposure) and that `HEAD` is allowed.
7. **GitLab sign-in.** Sign in with the registered application from both the Pages address and `localhost`. Expected: you return to the app, the token is saved under a name, **Test the token** works.
8. **Token hygiene.** Check that the token appears only in the `Authorization` header of the requests (Network tab) and nowhere in the address bar, the console or the page text.

### Results (to fill in)

| Check                                                | Browser | Result | Real text or notes |
| ---------------------------------------------------- | ------- | ------ | ------------------ |
| GitHub: browser access (CORS) from Pages             |         |        |                    |
| GitHub: browser access (CORS) from localhost         |         |        |                    |
| GitHub: multi-file commit                            |         |        |                    |
| GitHub: stale update text (status and message)       |         |        |                    |
| GitLab: multi-file commit                            |         |        |                    |
| GitLab: stale update text (status and message)       |         |        |                    |
| GitLab: pagination over 100 files                    |         |        |                    |
| GitLab: `HEAD` and `X-Gitlab-Last-Commit-Id` visible |         |        |                    |
| GitLab: sign-in with PKCE from Pages                 |         |        |                    |
| GitLab: sign-in with PKCE from localhost             |         |        |                    |
| Errors: refused, not found, read-only                |         |        |                    |
| Token only in the Authorization header               |         |        |                    |
