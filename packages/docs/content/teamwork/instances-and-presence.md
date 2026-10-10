---
id: instances-and-presence
title: Windows, people and presence
category: teamwork
summary: How MetaKit knows who has a model open, shows their avatars and selections, and tells windows apart.
keywords: [instance id, presence, presence file, avatars, remote selection, browser tab instance, who is here]
contexts: []
order: 120
---

A window of MetaKit is called an instance. Each instance shows itself to the others with a small file, and shows the others to you with avatars and coloured outlines. This is called presence.

## What it is

**Instance.** One browser tab is one instance. When a tab first needs an id, it makes 8 hexadecimal characters such as `7f3a1b2c` and keeps them in the tab's session storage. A reload keeps the id. A new tab gets a new one. The id is not a secret and never leaves the folder. It is the folder name under `_state/` where this tab writes (see [[sync-overview]]).

**Person.** Your display name and colour belong to your browser profile, not to the tab, so you look the same in every tab. They live in the browser's database, not in the workspace. You set them in [[profile]].

**Presence file.** Every instance writes `_presence/<instanceId>.json` into the workspace and reads the files of the others. It holds:

| Field | Meaning |
| --- | --- |
| `formatVersion` | Currently 1 |
| `instance` | The tab's id |
| `name`, `colour` | From your profile |
| `at` | When the file was written |
| `document` | `{kind, slug}` of the model or Kit open, or empty |
| `selection` | Ids of the objects selected |
| `editing` | The id of the object whose text you are editing, or empty |
| `hash` | A short fingerprint of the state of the open document |
| `seen` | How far this tab has read every instance's change files |

> **Note:** The presence file is the one file an instance rewrites. That is allowed because it is in the instance's own area. Change files are never rewritten.

## Where to find it

In Model mode, to the right of the save word in the toolbar there is a row of round avatars. The first one is you, with your colour and the tooltip "Name (you)". Others who have the same model open follow. The tooltip is their name. The letters inside are the initials of the first two words of the name, or "?" if there is no name.

On the canvas, objects selected by other people get an outline in their colour, with their initials.

## How to use it

1. Open the same model on two computers (see [[sync-overview]]).
2. Look at the avatar row. The other person appears within about ten seconds.
3. Select an object. On their screen it gets an outline in your colour.
4. If you start editing the text of an object that someone else is editing, you see a message: `Anna is editing this text too. You can go on; the last change wins.` Nobody is blocked.

## Every option explained

### Timing

| What | Value |
| --- | --- |
| Rewrite of your presence file | Every 10 seconds, and soon after your selection changes (not more often than once a second) |
| Someone counts as present | If their file is less than 30 seconds old |
| File removed | When you close the workspace in a normal way |

A tab that crashes leaves its file behind. After 30 seconds it no longer counts.

### What presence does not do

- It does not lock anything. Everyone can edit everything.
- It does not carry changes. Changes travel in change files only.
- It is not a login. Anyone can type any name.

### Two tabs of one person

Two tabs are two instances. If you open the same model in both, you appear twice in the avatar rows of others, and your tabs write to different `_state` folders. This is normal. Merging treats them like two people.

### Divergence check

Each presence file carries a `hash` of the state of the open document, and `seen`. MetaKit compares pairs of instances that have the same document open. If two instances have read exactly the same files, their hashes must be equal. If not, the model shows a warning: `Anna and Ben have read the same changes but see different models. Close and reopen the model; if this stays, tell whoever looks after MetaKit for you.` If their `seen` differ, one has just not caught up, and no warning appears.

## Examples

- Anna and Ben both have `order-process` open. Anna's avatar has a blue background and the letters "A". Ben's is "B" in green.
- Ben selects three tasks. Anna sees three green outlines labelled "B".
- Anna reloads her tab. She keeps the same instance id for the session, and so her old change files stay hers.

## Good to know

- **Attribution, not security.** The id and name say which tab wrote a change. There are no accounts. See [[concepts-no-server]].
- **Folder noise.** Each closed tab leaves a `_state/<id>/` folder with its snapshot. Do not delete them by hand while others are working: other instances may not have read the files yet.
- **Presence needs the folder.** If the folder sync is slow, avatars appear late. See [[sync-status]].
- **Name changes.** When you change your name in [[profile]], others see it with the next presence write.

## Related

[[sync-overview]] · [[sync-status]] · [[conflicts-and-merging]] · [[people-in-model]] · [[profile]] · [[top-bar]]
