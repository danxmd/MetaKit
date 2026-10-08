---
id: try-it-preview
title: Try it preview
category: build
summary: A live, throw-away model docked beside the Build editors, so you can place and connect objects of your tool while you build it.
keywords: [try it preview, live preview, preview dock, throw-away model, hot reload preview]
contexts: []
order: 230
---

The **Try it** preview is a small modelling canvas on the right of the Build view. It uses your tool library as it is right now, so you see the effect of every change as you make it.

## What it is

It is a real canvas with the same palette, shapes, grid and connecting rules as Model mode, running on a temporary model. Nothing you draw in it is saved: the hint under the title says "A live model of your tool. Nothing here is saved."

When you change the tool library, the preview rebuilds itself with the new definitions and keeps what you drew, as long as the same model type is still chosen. That is the hot reload of Build mode ([[page-build-view]]).

## Where to find it

It opens as a panel on the right of the Build view, labelled "Try it". Hide it with the **»** button in its header ("Hide the preview") or with the **Try it** button in the Build header, and bring it back with the same **Try it** button.

## How to use it

1. Add a model type and allow some classes in it ([[model-types]]).
2. Look at the tool buttons in the preview. **Select** is the pointer. There is one button for each allowed class and, after them, one for each allowed relation class.
3. Click a class button, then click on the canvas to place an object.
4. Click a relation class button, then click a first object and a second object to connect them.
5. Change the tool library, for example the colour of a class. The preview updates immediately.
6. To start again, hide the preview and show it again, or switch the model type.

## Every option explained

| Part | What it does |
| --- | --- |
| Model type list | Appears only when the tool library has more than one model type. The first (by key) is used until you choose another. Switching starts a new empty preview model. |
| **Select** | The selection tool. |
| Class buttons | One for each class that the model type allows and that is not abstract. They show the class labels. |
| Relation class buttons | One for each allowed relation class. |
| Canvas | The same canvas as in Model mode: pan, zoom, select, move, resize, connect ([[canvas-navigation]], [[placing-objects]], [[connecting-objects]]). The grid follows **Settings > Grid** ([[tool-settings]]). |
| Message line | Short hints and refusals from the canvas, for example why a connection is not allowed ([[interaction-hints]]). |
| **»** | Hides the preview. |

### Empty and incomplete states

| What you see | What to do |
| --- | --- |
| **Nothing to try yet** with "Add a model type under Metamodel, allow some classes in it, and you can place and connect objects here as you build." | Add a model type and tick classes ([[model-types]]). |
| A yellow notice "Allow a class in the model type to place it here." | Tick at least one class in the model type. |
| A relation class button is missing | The model type does not allow that relation class, or the relation class is abstract. |
| A connection is refused | The classes are not ticked at **From** and **To** of the relation class ([[relations]]). |

### What the preview does not do

- It is only the canvas. It does not start the rules and scripts of your tool library and has no attribute panel. To test behaviour and panels, use a real model ([[page-model-view]]).
- It does not show validation messages. Open a real model and use the Problems list ([[problems-panel]]).
- It does not take the choice of a view. Everything the model type allows is shown.

## Examples

With the Agent pipeline tool open, the preview chooses **Artifact lineage**, the first model type by key. The tool buttons are Select, Artifact, Gate, Task, Approves, Feeds and Produces. Use the model type list to switch to **Pipeline**. Now you also get Agent, Human and Stage, and Delegates to, Hands over to and Performs. Place a Task, an Agent and connect them with Performs. Then open **Appearance** of Task and change its fill colour: the Task in the preview changes at once, without losing your drawing.

## Good to know

- The preview is separate from Model mode. Models in your workspace are never touched by it.
- When the tool library changes, what you drew stays, and the tool you had chosen stays chosen.
- Hot reload also works for real models: models that are open in Model mode, in this or another window, pick up the change within a few seconds.
- To check a **Panel layout**, open a real model; the preview has no attribute panel ([[panel-layout]]).

> **Tip**
> Keep the preview open while you edit appearance. It is the quickest way to judge colours, sizes and labels.

> **Note**
> The preview uses the labels in the first language of the tool library ([[labels-and-help]]).

## Related

[[page-build-view]], [[model-types]], [[palette]], [[appearance-editor]], [[panel-layout]], [[tool-validation]]
