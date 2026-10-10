---
id: attribute-panel
title: Attribute panel
category: model
summary: The panel on the right shows and edits the attributes of whatever is selected, for one object or for several at once.
keywords: [attribute panel, side panel, object attribute panel, panel tabs, unknown attributes]
contexts: []
order: 210
---

Objects and connections carry data: a name, a status, a cost. You read and change that data in the attribute panel.

## What it is

The panel is the right-hand column of the [[page-model-view|model view]], 20 rem wide. It always shows the current selection. Which attributes appear, in which order and with which controls is decided by the Kit (see [[attributes]]). A method engineer can also design the panel with tabs and groups (see [[panel-layout]]).

## Where to find it

Right side of the model view. Select an object or a connection on the canvas and the panel fills.

## How to use it

1. Click an object on the canvas.
2. Read the heading. It names the kind of object, for example **Task**.
3. Change a value. Text fields save when you press **Enter** or click away. Switches, choices, dates and chips save at once.
4. Watch the shape on the canvas. It updates at once.
5. Press **Ctrl+Z** to undo. See [[undo-redo]].

To edit many objects at once, select them all (see [[selecting]]). Then change a field. It is set on every selected object, as one undo step.

## Every option explained

### What the panel shows

| Situation | What you see |
| --- | --- |
| Nothing selected | "Select an object to see its attributes." |
| One object or connection | The heading with its class or relation name, then its attributes. |
| Several objects | The heading "3 objects" (with the number) and the note "3 objects selected. Only attributes they all have are shown; a dash means the values differ." |
| Objects of kinds with nothing in common | "These objects have no attributes in common." |
| A selection of connections only | The attributes of the relation, for example **Condition** and **Handoff** of **Hands over to**. |
| Objects and connections selected together | The panel shows the objects. |
| Nothing to show in a designed panel | "There is nothing to show for this object." |

### Layout

- **Generated panel.** If the Kit has no panel layout for this kind, the attributes appear in one list. Attributes with a group name are put under a small heading, for example **Effort** or **Quality**.
- **Designed panel.** If the Kit has a layout, it can have tabs. Click a tab name or use the **Left arrow**, **Right arrow**, **Home** and **End** keys when a tab has the focus. The tab you chose is kept while you edit. Groups appear as framed boxes with a title. Fields can be hidden depending on other values, so a field may appear when you change another one. The Agent pipeline task panel has tabs **Overview**, **Effort** and more.

### Parts of a field

| Part | Meaning |
| --- | --- |
| Label | The name of the attribute. Hover it to see the help text as a tooltip. |
| Asterisk | The attribute is required. |
| (unit) | The unit, for example (h) or ($). |
| Control | The input. See [[field-types]]. |
| Red message | A problem with the value. It appears under the field. |
| Grey help text | The method engineer's explanation, shown under the field. |
| — (dash) | With several objects selected: their values differ. |

### Messages at the top

A red list at the top of the panel shows problems that belong to the whole object and to no single field, such as a constraint that involves two attributes. Example: "A finished task should say how much effort it took." See [[problems-panel]] and [[constraints]].

### Unknown attributes

If a model has values for attributes the Kit no longer defines, a folded section **Unknown attributes (n)** appears for a single selected object. It says "The Kit no longer has these attributes. The values are kept until you remove them." Each entry shows the attribute id, the stored value and a **Remove value** button. Removing is an undo step.

### Buttons

Some attributes are buttons. Clicking one runs a rule or script of the Kit on the selected object. They do not store anything. See [[behaviour-commands]].

## Examples

Select the task **Implement** in the Code review pipeline. The heading is **Task**. **Status** is **Running**. Change **Priority** to **High** (a choice with three options, shown as three buttons). Open the **Effort** group: type 1.5 in **Estimated effort (h)** and press **Enter**. **Variance** shows the calculated value. See [[computed-values]].

Now select the tasks **Implement** and **Merge**. Only the attributes both have are shown. **Name** shows a dash. Set **Status** to **Planned** and both tasks change together.

## Good to know

- Typing is saved when you leave the field or press **Enter**. **Escape** puts the saved value back. In multi-line text, **Enter** adds a line and only leaving the field saves.
- If a value cannot be understood, the field turns red and an explanation appears, for example `"abc" is not a number.` Nothing is saved until it is fixed.
- A refresh of the model, for example a colleague's change, does not wipe what you are typing.
- Calculated attributes are read-only. Their value comes from a formula. See [[computed-values]].
- Selecting a connection and an object together does not mix their attributes.
- The panel cannot edit the position or size of an object. Use the mouse. See [[moving-resizing]].

## Related

[[field-types]], [[references]], [[computed-values]], [[selecting]], [[editing-labels]], [[attributes]], [[panel-layout]]
