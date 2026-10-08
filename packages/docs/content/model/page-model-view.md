---
id: page-model-view
title: Model view
category: model
summary: The model view is the page where you draw and edit one model, with a palette on the left, the canvas in the middle and the attribute panel on the right.
keywords: [model view, model canvas, modelling page, drawing area, model window]
contexts: [model]
order: 10
---

The model view opens when you click a model on the [[page-models|Models page]]. Everything you need to draw, edit, check and export one [[concepts-model|model]] is on this one page.

## What it is

The model view is the main page of Model mode (see [[concepts-modes]]). It shows one model, drawn with the shapes of its [[concepts-tool-library|tool library]]. You can place objects, connect them, fill in their attributes, check the model for problems and export it as an image.

The page has four parts:

- **Header** at the top: the model name, the save status, the people working in the model, the menus and the find box. See [[model-toolbar]].
- **Palette** on the left: the kinds of objects and relations your tool library offers. See [[palette]].
- **Canvas** in the middle: the drawing area. A small overview map sits in its bottom right corner (see [[minimap]]). A hint line may sit in its bottom left corner (see [[interaction-hints]]).
- **Attribute panel** on the right: the values of the selected object. See [[attribute-panel]].

When you open **Problems** or **Script console** from the **Check** menu, a panel opens under the canvas. See [[problems-panel]].

## Where to find it

1. Open the **Models** page.
2. Click the name of a model.

To leave the model, click **← Models** at the top left of the header. MetaKit writes anything still waiting to be saved before it goes back.

## How to use it

1. Look at the header. The model name is on the left. Next to it you see **Saved** or **Saving…** (see [[status-and-messages]]).
2. Pick an object on the palette, for example **Task**, then click on the canvas to place it. See [[placing-objects]].
3. Click the object to select it. Its attributes appear on the right. Change a value there. See [[attribute-panel]].
4. Pick a relation on the palette, for example **Performs**, and drag from one object to another. See [[connecting-objects]].
5. Press **Ctrl+Z** if you change your mind. See [[undo-redo]].
6. Open **Check** and **Problems** to see whether the model follows the rules of the tool. See [[problems-panel]].
7. Use **File** and **Export as image or PDF…** to share a picture. See [[export-image]].

## Every option explained

| Part | What it does | Topic |
| --- | --- | --- |
| **← Models** | Saves and returns to the Models page. | [[page-models]] |
| Model name | Shows the name of the model. You rename a model on the Models page. | [[folders-and-search]] |
| Save status | Says **Saved**, **Saving…** or **Not saved**. | [[status-and-messages]] |
| Sync text | Says who changed the model last, for example "Saved. Last change from Anna, 12 s ago". | [[status-and-messages]] |
| Round avatars | Show who else has this model open. | [[people-in-model]] |
| Menus **File**, **Edit**, **View**, **Arrange**, **Check**, **Commands** | The things you can do. | [[model-toolbar]] |
| Icon buttons | Undo, redo, zoom out, fit, zoom in. | [[model-toolbar]] |
| Find box | Searches names and values in this model. | [[find-in-model]] |
| Palette | Chooses what to place or connect. | [[palette]] |
| Canvas | Where you draw. | [[canvas-navigation]], [[selecting]] |
| Overview map | Shows the whole model and the part you see. | [[minimap]] |
| Attribute panel | Edits the selected objects. | [[attribute-panel]] |
| Problems / Script console panel | Opens under the canvas. | [[problems-panel]], [[script-console]] |

## Examples

Open the sample model **Code review pipeline** from the Agent pipeline tool. The palette lists the objects **Agent**, **Artifact**, **Gate**, **Human**, **Stage** and **Task**, and the relations **Approves**, **Delegates to**, **Feeds**, **Hands over to**, **Performs** and **Produces**. The canvas shows two stages, **Plan** and **Build**, with agents, humans, tasks and artifacts inside them. Click the task **Implement** and the panel shows its **Status**, **Priority** and effort values.

## Good to know

- You never press a save button. Every change is saved as you make it. See [[concepts-no-server]].
- The layout is fixed: palette 13.5 rem wide, panel 20 rem wide. The canvas takes the rest.
- If the tool library changes in Build mode while you work, the canvas and the panel follow the change at once.
- Chrome and Edge on a desktop computer are supported. See [[browser-support]].

> **Tip**: Not sure what a control does? Turn on **Interaction hints** in the **View** menu. A line under the canvas then explains what you can do next.

## Related

[[model-toolbar]], [[palette]], [[attribute-panel]], [[canvas-navigation]], [[keyboard-shortcuts]], [[quick-tour]]
