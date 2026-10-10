---
id: troubleshooting
title: Troubleshooting
category: reference
summary: Common problems and messages, each with its cause and what to do, grouped by area.
keywords: [troubleshooting, error message, something is wrong, common problems, fix, not working]
contexts: []
order: 340
---

This page lists real messages and symptoms from MetaKit. Find your message, read the cause, and follow the fix. Quoted text is what the app shows. Names and numbers in quotes change from case to case.

## What it is

MetaKit tries to explain every problem in plain words and to say what to do. This page adds the usual cause behind each message. If your problem is not here, check the topic of the feature you were using (see the links at the end).

## Where to find it

Messages appear in four places: under the form you were using, as a note above the canvas, in the list of models, and in the script console (see [[script-console]]).

## How to use it

1. Copy the first words of the message.
2. Find them in the sections below.
3. Do the fix. If it does not help, do the simplest reset first: close the model and open it again.

## Every option explained

### Start page and browser

- **"Local folders need Chrome or Edge on a desktop computer. This browser cannot open them."** Firefox, Safari and phones cannot give web pages access to a folder. Use Chrome or Edge on a computer. See [[browser-support]].
- **"This folder is not a workspace yet" and "There is no workspace.json in ..."** You picked a folder with no MetaKit workspace. Create one with **Create workspace** or pick another folder. Existing files stay as they are. See [[concepts-workspace]].
- **"There is already a MetaKit workspace in this folder."** You tried to create a workspace where one exists. Open it instead.
- **The folder asks for access again after a restart.** Browsers drop folder access when closed. Press **Reopen** and allow access. This needs a click.
- **"Reopen" is missing.** The browser profile has no saved folder (private window, cleared data). Pick the folder again.

### Saving and sync

- **The save word says "Not saved" and the line says "Could not write changes: ...".** The folder cannot be written: read-only, removed drive, or access withdrawn. Fix the folder, or reopen it. See [[sync-status]].
- **A colleague's changes do not arrive.** Sync takes the time of your sync service plus about two seconds. Check that the service is running and that the folder is "Always keep on this device". See [[sync-overview]].
- **"The folder may not be set up well for sharing".** Files are slow, empty, unreadable or look like conflicted copies. Follow the advice in each line. Keep the folder on the device.
- **"... looks like a conflicted copy made by the sync service".** Two programs edited one file. MetaKit never does that. Find the other program. See [[sync-status]].
- **"... looks incomplete (it does not end with a new line) even after 5 more tries. If a sync program is still copying it, wait and try again."** A file is still arriving. Wait and reopen. If it stays, the file was cut short; restore it from your sync service.
- **"Anna and Ben have read the same changes but see different models. Close and reopen the model; if this stays, tell whoever looks after MetaKit for you."** Two windows disagree although they have the same files. Reopen. If it stays, keep the folder and report it. See [[instances-and-presence]].
- **"Anna changed Priority of "Review" at the same time as you. Anna's value was kept."** Not an error. Your change was replaced by a later one. Make it again if you want it. See [[conflicts-and-merging]].
- **"The Kit "x" has no saved content yet."** The folder holds the identity file but no state yet. The sync service has not delivered the `_state` files. Wait for sync.
- **A model or Kit is missing from the list.** It may be in the trash, or its files are unreadable, or still arriving. Check the deleted list ([[trash-and-restore]]). After 30 days a deleted item is no longer offered.
- **""models/x/..." already exists. Files that other instances may have read are written once and never replaced."** Something tried to overwrite a shared file. Reload the page. Do not copy files into `_state` by hand.
- **"This Kit document file was written by a newer version of MetaKit ...".** A teammate has a newer release. Reload the app to update. See [[format-versions]].

### Formulas

- **"Unexpected "or"" or "Unexpected "and"".** Formulas use `||`, `&&` and `!`. Write `||` instead of "or", or `OR(a, b)`. See [[formula-reference]].
- **"Minus needs a number, not an empty value."** One side is empty. Use `??`: `(ActualEffort ?? 0) - (Effort ?? 0)`.
- **""Name" is not known here."** The name is not an attribute of the object. Check the key (see [[keys-and-renaming]]) and the letter case.
- **"There is no function "foo"."** The function does not exist. The list is in [[formula-reference]]. Function names are not case sensitive.
- **"Methods cannot be called here; use a function such as upper(text) instead of text.upper()."** Formulas have functions, not methods.
- **"This formula takes too many steps."** The formula loops over too much. Make it smaller or use a script. See [[performance-limits]].

### Rules

- **A rule never runs.** Check that its switch is on, that the event matches (see [[rule-triggers]]), that the class and attribute pickers are right, and that the change was made in your own tab. Changes that arrive from other people never wake rules. Use **Try on the selected object**.
- **"Rule "X": the condition: ..."** The condition formula failed for this object. Read the detail after the colon.
- **"Rule "X": stopped because rules triggered each other more than 8 levels deep."** Two rules keep waking each other. Change one condition so the chain ends.
- **"... this rule runs before the action, so it can only cancel or ask. Use an event that says "changed" to change things."** Move the changes to an "after" event.
- **"Cancel only works for events that say "about to"...".** Hint only. Use a before event, such as "An attribute is about to change".
- **"Rule "X": there is no object to change."** A command rule ran with nothing selected. Select an object first.
- **"Rule "X": there is no attribute "Y" to set."** The attribute is not on that class, or it is calculated or a button.
- **"The script X does not exist."** The action **Run a script** needs the script's id. Use **Run a command** with the script's command label instead. See [[rule-actions]].

### Scripts

- **"The script took longer than 100 ms and was stopped."** A handler is too slow. Do the work in a command (5 seconds), or make it lighter. The script stays off until you change it. See [[scripts]].
- **"The script used more memory than it is allowed and was stopped."** Keep fewer or smaller lists in memory.
- **"Cannot find module "x". Scripts can only import from "metakit"."** Remove other imports. See [[script-api]].
- **"on() can only be used at the top level of a script, not inside a handler."** Register handlers and commands at the top of the script.
- **"This script tries to use files, but the Kit does not say it needs to."** Tick the permission in the Scripts section. If it says you have not allowed it, accept the permission dialog. See [[script-permissions]].
- **""x" already exists. Scripts can create new files but cannot replace existing ones; choose another name."** Use a new file name, for example with the date.
- **"This app cannot show a form." or "... cannot show a save-file dialog."** The web app does not provide these dialogs yet. Use messages, `ui.prompt`, or `files.write`.
- **A web call fails.** Browsers only let pages read answers from services that allow it. Use a service that does, or ask its owner. See [[script-permissions]].
- **"Completion and error checking are not available (...)".** The editor's checker did not start. You can still edit. Reload to try again.

### Git

- **"The token was refused. It may be wrong, expired or revoked."** Make a new token. See [[git-tokens]].
- **"The token cannot write to this repository."** The token is read only. Give it write rights.
- **"The repository was not found or the token cannot see it."** Check the spelling of the repository and that the token has access to it.
- **"The branch has changed since you last pulled. Pull first, then commit again."** Press **Pull**, then commit. See [[git-commit]].
- **"Could not reach GitHub. Check the address and your connection; the service may also refuse requests from a browser."** No connection, a wrong address for a self-managed service, or a block by the service.
- **"There is no GitHub token for github.com in this browser. Add one in the Git settings."** Tokens are per browser. Add one. See [[git-mode]].
- **"This folder does not hold a Kit: tool.json is missing."** Wrong folder in the repository. See [[git-layout]].
- **"GitHub is limiting requests. Wait a minute and try again."** Rate limit. Wait.
- **"The repository is too large for GitHub to list in one answer."** Use a smaller repository for the Kit.

### Assistant

- **"Add a key in the assistant settings first."** The assistant is on without a key. See [[assistant-overview]].
- **"The service did not accept this key. Check that it is complete and still active."** Paste the whole key again, or make a new one.
- **"Nothing was sent. The request was stopped because ..."** The guard stopped a request that could carry model content. No data left. See [[assistant-privacy]].
- **"The draft still has problems" and Accept is off.** Change your sentence and draft again. See [[assistant-drafts]].
- **"Draft with assistant" is off.** Turn on the assistant and add a key.

### Import and export

- **"This is not a valid zip file, or it is damaged, so it could not be opened."** The file is not a `.mkbundle` or `.mktool`, or was cut short. Download it again.
- **"This zip file holds more than 2,000 files ..."** or **"... unsafe name ..."** The zip is refused for safety.
- **"This is not a MetaKit bundle: there is no bundle.json in it."** Wrong file. See [[import-export]].
- **"This bundle does not include its Kit ..."** Import the Kit package first.

## Examples

- You see **Not saved** and "Could not write changes". You unplugged the USB drive. Reconnect it, close the model, open it again.
- A rule with "An attribute changed" does not fire when your colleague edits. That is by design: it runs in his tab.

## Good to know

- **Reloading is safe.** Your work is saved in the folder within two seconds of each change.
- **Ask for help with facts.** Tell the helper the message, the browser, and whether the folder is synced.
- **Never share tokens or keys** when you ask for help.

## Related

[[sync-status]] · [[formula-reference]] · [[rules]] · [[scripts]] · [[git-mode]] · [[assistant-overview]] · [[glossary]] · [[docs-help]]
