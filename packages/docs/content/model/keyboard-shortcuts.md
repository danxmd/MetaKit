---
id: keyboard-shortcuts
title: Keyboard and mouse shortcuts
category: model
summary: Every key and mouse gesture of the model view in one table, grouped by task.
keywords: [keyboard shortcuts, shortcut keys, mouse gestures, hotkeys, key bindings]
contexts: []
order: 340
---

This is the complete list of keys and mouse gestures in the model view. On a Mac, **Cmd** works wherever **Ctrl** is shown.

## What it is

A cheat sheet. Each row names the key or gesture, what it does, and where to read more.

## Where to find it

Here. Many shortcuts are also shown on the right side of menu items.

## How to use it

1. Click on the canvas once, so it has the keyboard focus.
2. Press the key.

Keys that change the model (**Delete**, **Ctrl+A**, arrows, **Escape**, copy and paste) work only while the canvas has the focus, not while you type in a field. **Ctrl+Z**, **Ctrl+Shift+Z** and **Ctrl+Y** also work after you clicked a button or a choice in the panel, but not inside a text field. **Ctrl+F** works everywhere on the page.

## Every option explained

### Undo, redo, find

| Key | What it does | More |
| --- | --- | --- |
| **Ctrl+Z** | Undo | [[undo-redo]] |
| **Ctrl+Shift+Z** or **Ctrl+Y** | Redo | [[undo-redo]] |
| **Ctrl+F** | Jump to the find box and select its text | [[find-in-model]] |
| **Escape** in the find box | Clear the search and close the results | [[find-in-model]] |

### Select

| Key or gesture | What it does | More |
| --- | --- | --- |
| Click an object or a line | Select it | [[selecting]] |
| **Shift** + click | Add to or remove from the selection | [[selecting]] |
| Drag on empty canvas | Rubber band: select everything fully inside | [[selecting]] |
| **Shift** + drag on empty canvas | Add the rubber band's contents to the selection | [[selecting]] |
| Click empty canvas | Clear the selection | [[selecting]] |
| **Ctrl+A** | Select everything | [[selecting]] |
| **Escape** | Cancel a drag; or, with nothing in progress, clear the selection | [[selecting]] |

### Place and connect

| Key or gesture | What it does | More |
| --- | --- | --- |
| Click a palette entry, then click the canvas | Place one object | [[placing-objects]] |
| Drag a palette entry onto the canvas | Place one object where you drop | [[placing-objects]] |
| Click a relation, then drag from object to object | Create a connection | [[connecting-objects]] |
| Drag from the edge of a selected object | Create a connection with any relation that fits | [[connecting-objects]] |
| **Escape** while placing or connecting | Return to the Select tool | [[placing-objects]] |
| Right-click while placing or connecting | Return to the Select tool | [[context-menu]] |
| **Tab** to a palette entry, then **Enter** or **Space** | Choose it, with the preview card shown | [[palette]] |
| **Escape** with the preview card open | Close the preview card | [[palette-preview]] |

### Move, resize, edit

| Key or gesture | What it does | More |
| --- | --- | --- |
| Drag an object | Move it (and the rest of the selection) | [[moving-resizing]] |
| **Alt** while dragging | No snapping | [[grid-and-snapping]] |
| Drag a handle of a selected object | Resize | [[moving-resizing]] |
| **Alt** while resizing | No grid snapping | [[grid-and-snapping]] |
| Arrow keys | Move the selection by one grid step (10 by default) | [[moving-resizing]] |
| **Shift** + arrow keys | Move by five grid steps | [[moving-resizing]] |
| Drag a line end onto another object | Reconnect | [[connecting-objects]] |
| Drag a connection line | Pull out a bend point | [[connecting-objects]] |
| Double-click a connection line | Add a bend point | [[connecting-objects]] |
| Double-click a bend point | Remove it | [[connecting-objects]] |
| Double-click an object | Edit its text | [[editing-labels]] |
| **Enter** in the text box | Save the text | [[editing-labels]] |
| **Shift+Enter** in the text box | New line | [[editing-labels]] |
| **Escape** in the text box | Discard the change | [[editing-labels]] |
| **Delete** or **Backspace** | Delete the selection | [[clipboard]] |

### Copy and paste

| Key | What it does | More |
| --- | --- | --- |
| **Ctrl+C** | Copy the selected objects and the connections between them | [[clipboard]] |
| **Ctrl+X** | Cut | [[clipboard]] |
| **Ctrl+V** | Paste, offset by 20 units each time | [[clipboard]] |

### Pan and zoom

| Gesture | What it does | More |
| --- | --- | --- |
| Mouse wheel | Zoom around the pointer | [[canvas-navigation]] |
| **Ctrl** + wheel, trackpad pinch | Zoom around the pointer | [[canvas-navigation]] |
| **Shift** + wheel | Move sideways | [[canvas-navigation]] |
| Hold **Space**, drag with the left button | Pan | [[canvas-navigation]] |
| Drag with the middle button | Pan | [[canvas-navigation]] |
| Drag with the right button | Pan | [[canvas-navigation]] |
| Click or drag in the minimap | Jump to that place | [[minimap]] |

### Attribute panel

| Key | What it does | More |
| --- | --- | --- |
| **Enter** in a one-line field | Save the value | [[attribute-panel]] |
| **Escape** in a field | Put back the saved value | [[attribute-panel]] |
| **Enter** in a multi-line field | New line (saves when you leave the field) | [[field-types]] |
| **Enter** in a duration box | Save the duration | [[field-types]] |
| **Left arrow** / **Right arrow** on a tab | Previous / next tab | [[attribute-panel]] |
| **Home** / **End** on a tab | First / last tab | [[attribute-panel]] |
| **Ctrl+V** in a table cell with spreadsheet cells copied | Fill the grid | [[field-types]] |

### Menus and panels

| Key | What it does | More |
| --- | --- | --- |
| **Escape** | Close an open menu | [[model-toolbar]] |
| **Down arrow** in the Problems filter box | Go to the first problem | [[problems-panel]] |
| **Down arrow** / **Up arrow** / **Home** / **End** in the problem list | Move between problems | [[problems-panel]] |
| **Escape** in the export dialog | Close it | [[export-image]] |

### Menu items with a shown shortcut

**Edit** shows **Ctrl+Z** (Undo), **Ctrl+Shift+Z** (Redo), **Ctrl+F** (Find), **Ctrl+A** (Select all) and **Del** (Delete selection). Other menu items have none: see [[menu-file]], [[menu-view]], [[menu-arrange]], [[menu-check]], [[menu-commands]].

## Examples

To tidy part of the Code review pipeline without the menu: drag a rectangle around the tasks, press **Shift+Right** twice to move them 100 units, press **Ctrl+C** and **Ctrl+V** for a copy, then **Ctrl+Z** to undo the paste.

To draw a **Performs** quickly: click it in the palette, press on **Planner**, drag to **Draft plan**, let go, then right-click to leave the tool.

## Good to know

- The mouse is not required to open menus: they are standard disclosure controls, so Tab to a menu name and press **Enter** or **Space**.
- To stop any mode, press **Escape**: it leaves place and connect, cancels a drag and clears a selection, in that order.

## Related

[[menu-edit]], [[canvas-navigation]], [[selecting]], [[connecting-objects]], [[clipboard]], [[model-toolbar]]
