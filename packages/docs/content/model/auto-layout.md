---
id: auto-layout
title: Auto-layout
category: model
summary: Auto-layout arranges the whole model, or just your selection, into a tidy left-to-right flow in one undoable step.
keywords: [auto-layout, automatic layout, arrange automatically, tidy up the model, layout engine]
contexts: []
order: 270
---

When a model has grown messy, let MetaKit place the objects for you.

## What it is

Auto-layout moves objects and routes the connection lines so that flows read from left to right with few crossings. It uses a layout engine called ELK that runs in the background, so the page stays usable. The result is one undo step.

## Where to find it

Open **Arrange** and click **Auto-layout**. See [[menu-arrange]].

## How to use it

1. To arrange everything, clear the selection (click empty canvas) or select only one object.
2. To arrange only part of the model, select two or more objects.
3. Open **Arrange** and click **Auto-layout**.
4. Wait a moment. When it finishes, a message says "Laid out the model. Undo restores the old positions."
5. Press **Ctrl+Z** if you prefer the old picture.

## Every option explained

| Situation | What happens |
| --- | --- |
| Nothing or one object selected | The whole model is arranged. |
| Two or more objects selected | Only those objects (with what their containers hold) are arranged. Everything else stays. |
| Containers and swimlanes | They are resized to hold their contents, with room for the title. Contents stay inside. |
| Connections | Get new bend points, with right-angled routes. Previous bends are replaced. |
| Result placement | The arranged group keeps the position of its top left corner. |
| Direction | Left to right. Layers are spaced further apart than neighbours (spacing 40, 60 between layers). |
| Unconnected parts | Separate groups of connected objects are placed side by side. |
| Message "There is nothing to arrange." | The layout found nothing to move or reroute, for example because the model is empty. |
| Message "The layout took too long and was stopped." | The engine stopped after 15 seconds. Nothing is changed. |

The menu has no further options in this version. The direction and spacing are fixed to the values above.

## Examples

In the Code review pipeline, drag a few tasks around until the picture is untidy. Click **Arrange**, **Auto-layout**. The stages **Plan** and **Build** grow or shrink to fit their contents, and the tasks line up from left to right in the order of their **Hands over to** connections. Select just the two tasks of **Plan** and run it again to tidy only those.

## Good to know

- Large models are handled with a faster, less thorough search. In our tests a model of 500 objects and 700 connections is laid out in under 2 seconds.
- Starting a new layout while one runs replaces the first.
- Your own bend points are replaced, so use auto-layout before hand-tuning connections.
- If you changed the model while the layout ran, objects that no longer exist are skipped.
- Auto-layout only changes positions, sizes of containers and bend points. Values are untouched.

> **Tip**: To tidy a few objects only, use [[align-distribute]]. It keeps everything else as it is.

## Related

[[menu-arrange]], [[align-distribute]], [[containers-swimlanes]], [[moving-resizing]], [[undo-redo]]
