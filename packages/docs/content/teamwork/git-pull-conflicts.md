---
id: git-pull-conflicts
title: Pull and conflicts
category: teamwork
summary: How Pull merges the repository into your tool library, and how to settle a clash with Keep mine or Take theirs.
keywords: [pull from git, git pull, three-way merge, keep mine, take theirs, merge clash, both sides changed the same thing]
contexts: [git.conflict]
order: 180
---

A pull brings the work of others from the repository into your tool library. Most pulls need no decision. When both sides changed the very same thing, a dialog asks you to choose.

## What it is

MetaKit merges three versions: the *base* (what the repository looked like at your last pull or commit), *yours* (your tool library now) and *theirs* (the branch now). It works in two steps.

1. **By file.** Files are matched by the id stored inside them, not by the file name. If one person renames a class and another edits its attributes, MetaKit still sees one class, and the two changes combine.
2. **By field.** Inside a matched file, each field is compared with the base. A field changed on one side only takes that change. A field changed on both sides to the same value is fine. Only a field changed on both sides to different values is a **clash**.

The merged tool library is applied to your open tool library as one batch of tool commands. That is one step in the undo list of Build mode, so one **Undo** takes the whole pull back.

## Where to find it

In Build mode, with a Git tool library open, press **Pull** in the top bar. If there are clashes, the dialog **Both sides changed the same thing** opens. See [[page-build-view]] and [[git-mode]].

## How to use it

1. Press **Pull**. The buttons wait while MetaKit works.
2. One of three things happens:
   - `Already up to date.` appears under the bar. Nothing changed.
   - `Pulled the changes from the repository.` The merge was clean.
   - The clash dialog opens.
3. In the dialog, read each clash. The heading names the part and the field, for example `Class: attributes > Name > labels > en`. Below it is the file path.
4. For each clash choose **Keep mine** or **Take theirs**. The chosen one is highlighted. The line at the top counts: "1 of 3 clashes decided".
5. When all are decided, **Apply choices** turns on. Press it. The note reads `Pulled the changes and kept your choices.`
6. To stop, press **Cancel**. Nothing is applied and your tool library stays as it was. You can pull again later.

## Every option explained

### The dialog

| Part | Meaning |
| --- | --- |
| Title | **Both sides changed the same thing** |
| Intro | "Everything else was merged. For each clash below, choose which value to keep." |
| Summary | "N of M clashes decided", or "1 of 1 clash decided" |
| Clash heading | The part and the field. For a whole file: `Class: the whole file`. If one side deleted a part and the other changed it: `Class: removed on one side, changed on the other`. |
| **Keep mine** (Your version) | Your value stays. |
| **Take theirs** (Their version) | The value from the repository replaces yours. |
| Value box | The value as text. Long values are cut after 600 characters. "(not there)" means the field or file does not exist on that side. |
| **Cancel** | Close without applying. |
| **Apply choices** | Applies the merge with your choices. Off until every clash is decided. |

### What a pull does to your link

After a clean pull or after **Apply choices**, the base moves to the new commit. Your own uncommitted changes stay pending and show in the count of **Commit and push**. You commit them later. See [[git-commit]].

### What a pull never does

- It does not commit anything.
- It does not touch files outside the layout, like a README. See [[git-layout]].
- It does not stop others from working in the shared folder. Their tool library is the same one. They see the pulled changes through folder sync. See [[sync-overview]].

## Examples

- Anna renames the class "Task" to "Work item" and commits. Ben, meanwhile, adds an attribute to "Task". Ben pulls. No dialog appears: the class has the new name and Ben's attribute.
- Anna and Ben both change the label of one attribute. Ben pulls and sees one clash, `Class: attributes > Status > labels > en`, with "Done" (mine) and "Finished" (theirs). He chooses **Take theirs**.
- Ben's pull shows a clash about a rule that Anna deleted and he edited. He chooses **Keep mine** and the rule stays.

## Good to know

- **Errors.** `The merged tool library cannot be read: ...` means the repository holds a broken file after the merge. Fix it on the hosting service. Messages about the token are in [[git-tokens]].
- **Pull before a long session** and before you commit. A commit is refused if the branch moved. See [[git-commit]].
- **Few clashes by design.** One file per part and field-level merging keep clashes rare. Two people editing the same attribute of the same class is the usual cause.
- **Not like folder sync.** In the shared folder the later change wins without asking (see [[conflicts-and-merging]]). In Git mode you decide.
- **Undo.** If you disagree with the result of a pull, press **Undo** in Build mode.

## Related

[[git-mode]] · [[git-commit]] · [[git-releases]] · [[git-layout]] · [[conflicts-and-merging]] · [[undo-redo]]
