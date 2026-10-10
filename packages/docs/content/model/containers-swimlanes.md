---
id: containers-swimlanes
title: Containers and swimlanes
category: model
summary: Containers and swimlanes hold other objects; dropping an object inside sets its container, moving the container moves its contents, and swimlanes grow to fit.
keywords: [drop into a swimlane, swimlane children, container children, nested objects, objects inside a container]
contexts: []
order: 160
---

Some object kinds in a Kit are *containers* or *swimlanes*. They can hold other objects, like a frame around a group.

## What it is

A container (or swimlane, which is a container drawn as a lane) is an ordinary object with a size and attributes. An object placed or dropped inside it becomes its *child*. The child stays attached: if the container moves, the child moves with it.

The Kit decides which kinds a container accepts. In the Agent pipeline, the **Stage** swimlane accepts **Agent**, **Human**, **Task**, **Gate** and **Artifact**. Another **Stage** is not accepted inside a stage.

## Where to find it

The palette shows containers and swimlanes next to normal objects. The preview badge says **Container** or **Swimlane**. See [[palette-preview]].

## How to use it

Put something inside:

1. Place a new object by clicking inside the container on the canvas. See [[placing-objects]].
2. Or drag an existing object so its centre ends inside the container. While you drag, the container the object would join is highlighted.
3. Let go. The object belongs to the container.

Take something out:

1. Drag the object so its centre is outside the container, onto empty canvas.
2. Let go. It becomes a top-level object again.

Move the whole group:

1. Press on an empty part of the container and drag. All its contents come along.

## Every option explained

| Situation | What happens |
| --- | --- |
| The centre of the dropped object is inside a container that accepts its kind | The container becomes its parent. |
| The container does not accept that kind | The object stays at the top level and no container is highlighted. |
| Containers inside containers | The deepest container that holds the centre and accepts the kind wins. If two are equally deep, the one drawn on top wins. |
| Object partly beyond the container edge | A swimlane grows (never shrinks) so that all its children fit with 10 units of space. |
| Moving the container | Its children move by the same distance, in one undo step. |
| Selecting a container and a child, then dragging | The child moves only once. |
| Deleting a container | The container goes. Its children stay and move up to the container's own parent, or to the top level. |
| Drawing order | A child is drawn above its container. |

An object cannot be moved into itself or into something it contains.

## Examples

In the Code review pipeline, the stages **Plan** and **Build** hold the actors, tasks and artifacts. Drag the task **Merge** out of **Build**, onto empty canvas: it is no longer in a stage. Drag it back inside **Plan**: **Plan** highlights while you hold, and when you let go **Merge** belongs to **Plan**. Drag the gate **Code review** over the stage **Plan** and drop it: a gate is accepted, so it joins.

## Good to know

- Everything is one undo step: a drop that also makes a lane grow is undone as one step.
- A model file can contain a child whose container no longer exists, or where the container does not accept the child. The [[problems-panel]] reports this, for example "sits in the container ..., which does not accept ... elements."
- Auto-layout keeps children inside their containers and sizes the containers to fit. See [[auto-layout]].
- Copying a container copies only the objects you selected. Select the children too if you want them. See [[clipboard]].

## Related

[[placing-objects]], [[moving-resizing]], [[auto-layout]], [[classes]], [[model-types]], [[clipboard]]
