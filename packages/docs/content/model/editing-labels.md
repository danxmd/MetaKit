---
id: editing-labels
title: Editing labels on the canvas
category: model
summary: Double-click an object to type its name directly on the canvas; Enter saves, Shift+Enter adds a line, Escape cancels.
keywords: [editing labels, edit text on canvas, label editor, double-click to edit, in-place text editing]
contexts: []
order: 170
---

The quickest way to name an object is to type on the object itself.

## What it is

Every object shows a label. It is the value of the first text attribute of its class, for example **Name** of a **Task**. If that is empty, the shape shows the name of the class instead. Double-clicking the object opens a small text box over it where you change that value.

## Where to find it

On the canvas, with the **Select** tool. Not available while you are placing or connecting.

## How to use it

1. Double-click an object. A text box opens over it with the current text selected.
2. Type the new text.
3. Press **Enter** to save. Or click anywhere else.
4. Press **Escape** to throw the change away.

## Every option explained

| Key or action | Result |
| --- | --- |
| Double-click an object | Opens the text box. |
| **Enter** | Saves the text and closes the box. |
| **Shift+Enter** | Starts a new line in the text. |
| **Escape** | Closes the box. The old text stays. |
| Click outside the box | Saves the text, like **Enter**. |
| Saving empty text | Clears the value. The shape shows the class name again. |

The box is at least 80 by 32 pixels and grows with the zoom level, so it always sits over the object.

### Messages

- `This kind of object has no text to edit. Use the panel on the right.` The class has no text attribute. Select the object and use the [[attribute-panel]].
- `Anna is editing this text too. You can go on; the last change wins.` Someone else has the same text box open. With two people the message says "Anna and Sam are editing...". See [[people-in-model]] and [[conflicts-and-merging]].

### What a double-click does elsewhere

- Double-click a connection line: adds a bend point (see [[connecting-objects]]). Labels of connections are edited in the panel.
- Double-click a bend point of the selected connection: removes it.
- Double-click empty canvas: nothing.

## Examples

Double-click the task **Draft plan** in the Code review pipeline, type `Draft the plan`, press **Enter**. The shape updates at once, and the **Name** field in the panel shows the same text. **Ctrl+Z** puts "Draft plan" back.

## Good to know

- Saving the text is one undo step, and the panel and the shape show it immediately.
- The text must follow the rules of the attribute, like a maximum length. If it does not, the [[problems-panel]] lists a warning. See [[field-types]].
- When the label attribute is a long text, **Enter** still saves. Use **Shift+Enter** for line breaks.
- Only the first text attribute can be edited this way. All other attributes are in the panel.

## Related

[[attribute-panel]], [[field-types]], [[undo-redo]], [[selecting]], [[keyboard-shortcuts]]
