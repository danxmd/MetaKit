---
id: connecting-objects
title: Connecting objects
category: model
summary: Draw a relation between two objects by choosing it in the palette and dragging, or by dragging from the edge of a selected object; then bend, reconnect or delete the connection.
keywords: [connecting objects, connect tool, draw a connection, bend point, reconnect a connection, relation chooser]
contexts: []
order: 140
---

A connection (also called a connector) joins two objects and has a *relation*, such as **Performs** or **Feeds**. The Kit decides which relations may join which kinds of object.

## What it is

Every connection has a start object, an end object and a relation class. Creating one is one undo step. The connection is selected afterwards, so its attributes show in the panel. Connections have attributes of their own when the relation defines them. For example **Hands over to** has **Condition** and **Handoff**.

## Where to find it

In the **Relations** list of the [[palette]], and on the canvas. [[smart-modelling]] offers a third way.

## How to use it

Way 1, with the palette:

1. Click a relation under **Relations**, for example **Performs**. The cursor is a crosshair. Objects where this relation can start are outlined when you point at them.
2. Press on the start object and keep the button down.
3. Drag to the end object. A line follows the pointer. It is shown as allowed when the relation fits, and the end object is outlined.
4. Let go. The connection appears.
5. Draw more with the same relation, or press **Escape**, right-click, or click **Select** to stop.

Way 2, from the edge of an object:

1. Click an object to select it.
2. Move the pointer to its edge (about 6 pixels wide band). The cursor becomes a crosshair.
3. Press, drag to another object and let go.
4. If more than one relation fits, a small menu lists them by name. Click one, or click **Cancel**. If only one fits it is used at once.

Change an existing connection:

1. Click the line to select it.
2. Drag one of its end points onto another object to **reconnect** it.
3. Drag the line itself to pull out a **bend point**. Drag a bend point to move it.
4. Double-click the line to add a bend point there. Double-click a bend point to remove it.
5. Press **Delete** to remove the connection.

## Every option explained

| Gesture | Result |
| --- | --- |
| Palette relation, then drag object to object | Creates a connection with that relation. The tool stays on. |
| Drag from the edge of a selected object | Creates a connection. A menu appears if several relations fit. |
| Menu item (relation name) | Uses that relation. |
| Menu item **Cancel** | Creates nothing. |
| Let go on empty canvas | Nothing is created and no message is shown. |
| Let go on a wrong target | Nothing is created and a message explains why (see below). |
| Click a line | Selects the connection. |
| Drag a line end onto another object | Moves that end, if the relation allows the new object. |
| Drag the line itself | Adds a bend point and moves it. |
| Drag a bend point | Moves it. It snaps to the grid. |
| Double-click a line | Adds a bend point. |
| Double-click a bend point | Removes it. |
| **Delete** or **Backspace** | Deletes the selected connection. |
| **Escape** during a drag | Cancels the drag. |
| **Escape**, right-click | Leaves the connect tool. |

### Messages when a connection is refused

- `A "Performs" cannot go from a Agent to a Human in this model type.` appears when the chosen relation does not allow these two kinds. The names are the keys of the relation and the classes, in the pattern `A "<relation>" cannot go from a <class> to a <class> in this model type.`
- `No relation allows a connector from a Artifact to a Artifact in this model type.` appears when you drag from the edge and no relation fits at all.
- `A connector needs two different elements.` appears when you drop on the object you started from.

Messages show over the canvas for six seconds. See [[status-and-messages]].

### How the line is drawn

Without bend points the line leaves the facing edges of the two objects and turns at right angles in the middle. With bend points it runs in straight pieces through them. The arrowheads and line style come from the Kit.

## Examples

In the Code review pipeline, click **Performs**, press on the agent **Planner**, drag to the task **Draft plan** and let go. The connection is created. Now press on **Planner** and drop on **Sam**, a **Human**, with **Performs** still chosen. Nothing is created. The message says that a **Performs** cannot go from an Agent to a Human, because the Kit says **Performs** goes from an *Actor* (an Agent or a Human) to a *Task*.

Select the **Merge** task and drag from its edge to the gate **Code review**. Only **Hands over to** fits Task to Gate, so no menu appears. Drag from an artifact to a task: only **Feeds** fits, and it is created.

## Good to know

- Only relations that are in the active palette view can be used. Switch the view to **All** if a connection is refused unexpectedly. See [[menu-view]].
- Rules about how many connections an object must or may have (cardinality) are not enforced while drawing. They show up as warnings in the [[problems-panel]].
- You can draw several connections between the same two objects.
- Deleting an object deletes the connections attached to it. Undo restores both.
- With **Interaction hints** on, the line under the canvas tells you which end to click next and what the relation connects. See [[interaction-hints]].
- A connection can be selected together with other things, but only objects and their attributes show when both are selected.

> **Tip**: Not sure what a relation can connect? Hover its palette entry or turn on [[smart-modelling]], which lists every legal target for an object.

## Related

[[palette]], [[smart-modelling]], [[selecting]], [[relations]], [[model-types]], [[undo-redo]], [[keyboard-shortcuts]]
