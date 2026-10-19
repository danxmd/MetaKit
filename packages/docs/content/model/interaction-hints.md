---
id: interaction-hints
title: Interaction hints
category: model
summary: When switched on, a one-line hint at the bottom of the canvas tells you what you can do next and what a relation connects.
keywords: [interaction hints, hint line, modelling hints, canvas hint, hints on the canvas]
contexts: []
order: 300
---

Interaction hints are a gentle teacher. They say in one sentence what MetaKit expects from you right now.

## What it is

A small line with an "i" mark at the bottom left of the canvas. The text changes with what you are doing: nothing selected, placing, connecting, hovering over a palette entry or over a connection.

## Where to find it

It is off by default. Switch it on in **View**, **Interaction hints** (under **Assistance**). The menu item has a tick when it is on. The tooltip reads "Short hints about what you are doing and what a relation connects".

## How to use it

1. Open **View** and click **Interaction hints**.
2. Work as usual and glance at the line.
3. Switch it off the same way when you no longer need it.

The setting belongs to you and your browser. It is not saved in the model and does not affect colleagues.

## Every option explained

The line shows one of these sentences. Classes and relations are named by their labels (for example **Hands over to**). The classes at each end of a relation are the ones you can place: an abstract class such as **Actor** is named by the classes that extend it, **Agent** and **Human**, and only classes the model type allows are named.

| What you do | What the line says |
| --- | --- |
| Nothing selected, Select tool | "Choose a concept on the left and click on the canvas to place it. Drag from a concept to connect it." |
| One object selected | "Edit the attributes on the right. Drag the handles to resize. Delete removes it." |
| Several selected | "3 selected. Drag to move them together, or use Arrange to align them." |
| Placing an object | "Click on the canvas to place a Task. Press Escape to stop." ("an" before a vowel, as in "place an Artifact") |
| Connect tool active | "Press on an outlined concept where the Performs should start and drag to where it ends. Performs connects an Agent or a Human to a Task." |
| Connect tool, after pressing on a start | "Let go on an outlined concept where the Performs should end. Performs connects an Agent or a Human to a Task." |
| Connect tool without a relation | "Choose a relation in the palette, then click the concept it should start at." |
| Pointer over a relation in the palette | "Performs connects an Agent or a Human to a Task." |
| Pointer over an object in the palette | "Task can be connected with Feeds, Hands over to, Performs or Produces." Every relation of the model type that may start or end at the class, or at a class it extends, is named. Or "Stage: click on the canvas to place it." if nothing can connect to it. |
| Pointer over a connection (Select tool) | "Performs: Agent to Task. Performs connects an Agent or a Human to a Task." |

Where a relation can start or end at several kinds, the sentence lists them: "Hands over to connects a Gate or a Task to a Gate or a Task." When the model type allows none of the classes at an end, it says "nothing in this model type".

The words "concept" and "object" mean the same thing.

## Examples

Switch hints on and click **Performs** in the palette of the Code review pipeline. The agents and humans are outlined, and the line says "Press on an outlined concept where the Performs should start and drag to where it ends. Performs connects an Agent or a Human to a Task." Press on the agent **Planner**: now the tasks are outlined and the line says "Let go on an outlined concept where the Performs should end." Press **Escape**, then move the pointer over any **Performs** connection and the line names both ends, for example "Performs: Agent to Task."

## Good to know

- Hints for the palette come from the same Kit definitions as the [[palette-preview]] card.
- Messages about a refused connection are separate. They appear for six seconds as a notice. See [[status-and-messages]].
- Hints are for learning. People who know a Kit well can switch them off.

## Related

[[smart-modelling]], [[menu-view]], [[palette]], [[palette-preview]], [[connecting-objects]]
