---
id: people-in-model
title: People in a model
category: model
summary: Round avatars in the header show who else has the model open, and their selections appear on your canvas in their colour with their initials.
keywords: [people avatars, people badges, other people in the model, selection of others, collaborators]
contexts: []
order: 320
---

Several people can work in the same model at the same time. MetaKit shows who is there, so you do not step on each other's toes.

## What it is

Everyone who opens a model through the same workspace folder appears as a round badge in the header, with their initials on their own colour. What they select is outlined on your canvas. Changes made by others arrive by themselves while you work. See [[sync-overview]] for how this works without a server.

## Where to find it

- Avatars: in the first header row, next to the save status.
- Other people's selections: on the canvas.
- Notes about simultaneous edits: as notices on the canvas. See [[status-and-messages]].

## How to use it

1. Open a model. Your own avatar is the first, with a ring around it.
2. When a colleague opens the same model, their avatar appears. Hover it to see their name.
3. Look at the canvas. Objects they have selected get an outline in their colour with their initials above the top left corner. Avoid editing the same object at the same moment.
4. Change your name or colour in your profile. See [[profile]].

## Every option explained

| What you see | Meaning |
| --- | --- |
| Badge with a ring | You. The tooltip is your name and "(you)". |
| Other badges | People with this model open right now. The tooltip is their name. |
| Initials | The first letters of the first two words of the name. A single word gives one letter; no name gives "?". |
| Badge colour | The colour that person chose in their profile. |
| Coloured outline with initials on the canvas | The objects that person has selected. |
| Message "Anna is editing this text too. You can go on; the last change wins." | You opened the text editor on an object where Anna has the editor open. See [[editing-labels]]. |
| Notice "Anna changed Status of "Implement" at the same time as you. Anna's value was kept." | A real clash happened. Details below. |

### Windows, not only people

Every browser tab is one *instance*. If you open the same model in two tabs, you see yourself twice. The name and colour belong to the browser profile. See [[instances-and-presence]].

### When two people change the same value

MetaKit keeps the change that was made last, field by field. If your change and someone else's hit the same field at the same time, the other person's value stays and a notice tells you what happened. Changes to different fields, or different objects, merge without any message. See [[conflicts-and-merging]].

## Examples

Two people open the Code review pipeline. Anna selects the task **Implement**; Sam sees a coloured outline with "A" over it. Sam changes the **Priority** of **Merge** and Anna sees it change a moment later. If both change the **Status** of **Implement** together, one notice appears with the other person's name and "'s value was kept".

## Good to know

- Your undo only undoes your own steps. See [[undo-redo]].
- Presence shows only people who have this model open, not everyone in the workspace.
- Selections of others are shown only for objects, not for connections.
- Nothing here needs an account or a server. See [[concepts-no-server]].

## Related

[[sync-overview]], [[instances-and-presence]], [[conflicts-and-merging]], [[profile]], [[status-and-messages]]
