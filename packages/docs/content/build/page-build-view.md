---
id: page-build-view
title: Build view
category: build
summary: The screen where method engineers shape a Kit, with a section list on the left, an editor in the middle and a live "Try it" preview on the right.
keywords: [build view, build mode screen, kit editor, method engineering screen, metamodelling screen]
contexts: [build]
order: 10
---

The Build view is where you design a Kit. You describe the kinds of objects, how they connect and how they look. Everything you change is saved at once and shown in the "Try it" preview next to it.

## What it is

A Kit is a plain JSON file that tells MetaKit which classes, relation classes, model types, looks, rules and scripts a modeller may use (see [[concepts-kit]]). The Build view is the editor for that file. You never type JSON. Every field in every editor is a normal form control.

The screen has four parts:

1. A **header** across the top with the name, version, save status, undo and redo, and (for Git Kits) the **Source control** menu.
2. A **section list** on the left, grouped under four headings.
3. For lists of things (classes, relation classes, model types), an **item list** with an input for adding new ones.
4. The **editor** for the selected item, and on the right the docked **Try it** preview ([[try-it-preview]]).

## Where to find it

Switch to Build mode with the mode switch in the top bar, then open a Kit with **Edit** (see [[page-kits]] and [[concepts-modes]]). To leave, use **← Kits** at the top left of the header.

## How to use it

1. Open a Kit in Build mode. A new Kit starts empty.
2. Pick a section on the left. Start with **Classes** under **Metamodel**.
3. Type a name in the **New class** box and press **Add** (or Enter). The new class opens in the editor. Or press **Add from catalog…** to pick ready-made classes ([[class-catalog]]).
4. Fill in the editor. See [[classes]], [[attributes]] and [[appearance-editor]].
5. Watch the **Try it** preview on the right. Place the class and connect objects to see how the Kit feels.
6. Add relation classes and a model type so modellers can use the classes. See [[relations]] and [[model-types]].
7. Click **← Kits** when you are done. Pending changes are written first.

## Every option explained

### Header

| Control | What it does |
| --- | --- |
| **← Kits** | Writes pending changes and goes back to the Kits page. |
| Name box (label "Kit name") | The name modellers see when they create a model. An empty name is ignored. |
| **Version** | The Kit version, for example `1.0.0`. Models remember which version made them. A text that is not a version is refused with "A version looks like 1.0.0." (the form is `1.0.0`, optionally followed by `-beta.1` or `+build5`). |
| Status text | **Saving…** while changes are being written, **Saved** when everything is written. If saving or syncing fails, the error text is shown here instead. |
| **↶** (Undo) and **↷** (Redo) | Step back and forward through your changes. They are greyed out when there is nothing to undo or redo. |
| **Source control** | Appears only for a Kit linked to GitHub or GitLab. It holds **Commit and push**, **Pull** and **Releases**. See the next section. |
| **Try it** | Shows or hides the preview on the right. The **»** button inside the preview hides it too. |

### Section list

The sections are grouped under four headings. A number next to a section is how many items it holds.

| Group | Sections | Topic |
| --- | --- | --- |
| **Metamodel** | **Classes**, **Relation classes**, **Model types** | [[classes]], [[relations]], [[model-types]] |
| **Appearance** | **Shapes** | [[shapes-section]] |
| **Behaviour** | **Rules**, **Scripts** | [[rules]], [[scripts]] |
| **Kit** | **Settings** | [[kit-settings]] |

More on moving around is in [[build-navigation]].

### Source control menu

The menu shows the linked repository and branch, for example `acme/tools · main`. **Commit and push** shows the number of pending changes in brackets, for example "Commit and push (3)". **Pull** and **Releases** are greyed out while Git is busy. Choosing an entry closes the menu. The dialogs are explained in [[git-commit]], [[git-pull-conflicts]] and [[git-releases]]. The overall idea is in [[git-mode]].

### Notices under the header

- A green note appears after a Git action succeeds.
- A red message appears when a command is refused, for example "The key "Task" is already used by another class." Nothing changed in that case. The message disappears after the next successful change.
- A yellow banner reads "N problems in this Kit". Open it to see up to 20 entries, each as `path: message`. See [[kit-validation]].

### Full-screen editors

Three editors open over the whole Build view and close with **Done**, **Close** or **Save and close**: the Appearance editor ([[appearance-editor]]), the panel layout editor ([[panel-layout]]) and the advanced drawing editor ([[shape-editor]]).

## Examples

Open the Agent pipeline Kit. Under **Classes** you see Actor, Agent, Artifact, Gate, Human, Stage and Task. Select **Task** to see its attributes (Name, Status, Priority, Effort and more), its constraints and its panel layout. Switch to **Model types** to see **Pipeline** and **Artifact lineage**: two ways to model with the same classes. Keep the **Try it** preview open and tick or untick a class in a model type to watch the palette change.

## Good to know

- **Every edit is a command.** The editors never write the file directly. Each change goes through the same command system as in Model mode, so it can be undone and redone, synced and shared. A single action that touches several things (renaming a key, adding a class with its look) is one undo step.
- **Hot reload.** Models that are open in Model mode, in this window or another one, pick up your change within a few seconds. Palette labels, looks and attribute panels update without reopening the model. The preview in the Build view updates at once.
- **Nothing is lost by a refused change.** If the app refuses a command, the Kit stays exactly as it was.
- **Browsers.** Build mode needs Chrome or Edge on a desktop. See [[browser-support]].

> **Tip**
> Use the Undo button in the header, not the browser back button. Undo only covers this Build session.

> **Note**
> Build mode and Model mode share one store for Kits and models. A Kit you have open in Build mode is also synced to the other windows like any other document. See [[sync-overview]].

## Related

[[build-navigation]], [[try-it-preview]], [[kit-validation]], [[concepts-modes]], [[concepts-kit]], [[page-model-view]]
