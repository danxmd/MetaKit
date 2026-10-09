---
id: concepts-modes
title: Model mode and Build mode
category: start
summary: MetaKit has two areas, Model for drawing models and Build for making the tool libraries that models are drawn with.
keywords: [model mode, build mode, two modes, mode switch, area switch, modelling versus metamodelling]
contexts: []
order: 50
---

MetaKit keeps two jobs apart. In **Model** you draw. In **Build** you define what can be drawn. You switch between them with the two buttons in the [[top-bar]].

## What it is

| | Model | Build |
| --- | --- | --- |
| Who uses it | Modellers | Method engineers |
| What you work on | A [[concepts-model|model]] | A [[concepts-tool-library|tool library]] |
| List page | [[page-models|Models]] | [[page-tool-libraries|Tool libraries]] |
| Editor | [[page-model-view|Model view]] | [[page-build-view|Build view]] |
| Typical actions | Place objects, connect them, edit attributes, find, check, export | Add classes and attributes, draw shapes, set rules, write scripts |

The same person often does both. Method engineers try their library in Model; modellers sometimes fix a small thing in Build.

## Where to find it

The **Model** and **Build** buttons sit in the middle of the [[top-bar]], in a group labelled "Area". The active one is highlighted. They appear on every page once a workspace is open.

## How to use it

1. Choose **Model** to see the list of models. Click a model to open it.
2. Choose **Build** to see the list of tool libraries. Click **Edit** on a card to open one.
3. Use **← Models** in the Model view, or **← Tool libraries** in the Build view, to return to the list.
4. Click the other area button at any time to switch.

## Every option explained

- **Switching closes what is open.** Choosing **Build** while a model is open closes the model. Choosing **Model** while a tool library is open closes the tool library. Your changes are already saved, because MetaKit saves as you work.
- **The list remembers where you were.** With nothing open, the area you last chose stays. "Back" from a tool library lands on the Tool libraries page, not on the models.
- **Empty workspace.** In a new workspace the Models page offers **New model**, where you can pick a built-in tool library, and **Go to Build**, which does the same as the **Build** button.
- **Live updates.** If a tool library is changed while models are open, the models follow. Changes in Build apply to existing models at once.

## Examples

Anna, a method engineer, opens **Build**, clicks **Edit** on **Agent pipeline** and adds a Task attribute called Priority. She presses **Model**, opens "Code review pipeline" and sees the new Priority field in the attribute panel of every Task.

## Good to know

- The editors also differ in what they offer. Model mode has a palette, canvas and attribute panel. Build mode has a list of classes, relation classes and so on, with a form beside it. A preview called **Try it** lets you test a tool library without leaving Build ([[try-it-preview]]).
- Git and the assistant belong to Build and the settings menu, not to Model ([[settings-menu]]).
- The mode is not part of the file. Anyone with the workspace can use both.

## Related

- [[top-bar]]
- [[page-models]]
- [[page-tool-libraries]]
- [[quick-tour]]
- [[welcome]]
