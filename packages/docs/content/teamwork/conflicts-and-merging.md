---
id: conflicts-and-merging
title: Conflicts and merging
category: teamwork
summary: What happens when two people change the same thing at the same time, and what you will see.
keywords: [concurrent edits, merge rules, clash notice, tombstone, divergence, same time edit, resolved clash]
contexts: []
order: 130
---

In a shared folder, two people can change the same model at once, even offline. MetaKit merges their work without asking, using simple fixed rules. This page explains the rules so that results never surprise you.

## What it is

Every document is a set of small values, called registers. Each register is one field, such as the name of one object, or the x position of one object. Every edit writes a register with a stamp. The stamp is a time plus a counter, from a hybrid logical clock (see [[sync-overview]]).

When two stamps are compared, the later one wins. If they are exactly equal, the larger instance id wins. Every computer applies this rule to the same files, so all of them end in the same state.

## Where to find it

You see the result on the canvas and in short notices above the canvas. Each notice has a **×** button (label "Dismiss"). There is no merge screen, because the rules do not need one.

For tool libraries in Git mode there is a real conflict dialog, because Git is not live. See [[git-pull-conflicts]].

## How to use it

1. Work as usual. You do not have to do anything to merge.
2. If a notice appears, read who won. Press **×** to dismiss it.
3. If your change was replaced and you still want it, make the change again. It then has a later stamp and wins.
4. If you disagree about something, agree it in words and one of you edits again.

## Every option explained

### The rules

| Situation | Result |
| --- | --- |
| Two people change **different fields** of one object | Both changes stay. |
| Two people change the **same field** | The later stamp wins. The other value is dropped. |
| One person **deletes** an object, another edits it at the same time | The object is gone. The edit is dropped. |
| One person deletes, then **undoes** the delete | The object returns, with its content. A returned object beats the earlier delete. |
| Two people **move** the same object | The later position wins. Each of x and y is its own field. |
| Two people **add rows** to the same table at the same time | One whole table wins. A table is one value. |
| Two people **add attributes** to the same class at the same time in Build mode | One list wins. The list of attributes is one value. Add attributes one after the other. |
| Two people **add different objects** | Both appear. Each object is its own unit. |
| A connector's **end object is deleted** | The connector is hidden. It is not erased from the file. |
| Two people edit **two different rules or scripts** | Both stay. Each rule and script is one unit. |

### Deletes are tombstones

A delete does not erase data from the files. It writes a *death* stamp. An object is alive when it has no death, or when its newest birth is later than its death. This is what lets an undo of a delete bring an object back, and what makes a delete win over edits that were made without knowing about it. Deleted data is dropped from snapshots after 30 days. See [[history]].

### Clash notices

A notice appears on your screen only if all of these are true: you changed a field, someone else changed the same field, and they had not yet read your change when they made theirs. Then their value replaced yours.

The text is plain: `Anna changed Priority of "Review" at the same time as you. Anna's value was kept.` It names the field and the object, never paths or ids. If the field is a position or a size the words are "the position" or "the size". For a model name: "the model name".

### Undo among people

Undo is yours. It reverts only your own last step, and only where the value is still what your step left. If someone else changed a field since, that part of your undo is left alone, so one person's undo never throws away another person's work.

### Rules and scripts

Changes that arrive from others do not wake rules or scripts in your tab. Their own tab ran them, and the results come to you as ordinary changes. See [[rule-triggers]].

## Examples

- Anna sets Priority to High, Ben sets Owner to "Ben", both on the same task. Both stay.
- Anna and Ben both set the Status of a task. Anna's stamp is 10:00:03.512, Ben's is 10:00:03.900. Ben's value stays on both screens. Anna sees: `Ben changed Status of "Review" at the same time as you. Ben's value was kept.`
- Ben deletes a task offline. Anna edits it online. When Ben's files arrive, the task disappears for Anna, and her edit is dropped.

## Good to know

- **Last writer wins is simple, not smart.** Nothing compares meaning. Two people who both edit a long description will lose one version. Agree who edits what.
- **Clocks.** The stamp comes from the computer's clock but never goes backwards, and adopts later stamps it sees. A badly wrong clock on one computer can make its edits win too often. Keep the clocks right.
- **Commutative.** The order in which files arrive does not matter. Merging the same files twice changes nothing.
- **Different from Git.** In Git mode the person decides each clash. See [[git-mode]].
- **Disagreement warning.** If two windows read the same files but still differ, a warning appears. See [[instances-and-presence]].

## Related

[[sync-overview]] · [[sync-status]] · [[instances-and-presence]] · [[history]] · [[undo-redo]] · [[git-pull-conflicts]]
