---
id: mind-map
title: Mind map and concept map
category: kits
summary: A built-in Kit for mind maps that grow from a central topic into topics and ideas coloured by branch, and for concept maps of concepts joined by labelled links.
keywords: [mind map, concept map, central topic, topic, idea, concept, branch, branch colour, labelled link, brainstorming, note]
contexts: []
order: 400
---

**Mind map and concept map** is a built-in Kit for thinking on a canvas: collecting ideas around one subject, or showing how a set of ideas relate to each other.

## What it is

A **mind map** grows from one **Central topic**. **Topics** branch from it, and **Ideas** branch from the topics. Give a topic a **Colour** and everything that hangs from it takes that colour, so each branch stands out.

A **concept map** has no centre. **Concepts** are joined by **Links** whose labels read as sentences, such as "Budget *also pays for* Travel".

| Class | What it stands for |
| --- | --- |
| **Central topic** | The subject of the mind map, in the middle. |
| **Topic** | A main branch, with its **Colour**. A sub-topic without a colour takes the colour of the topic above. |
| **Idea** | A thought on a branch. It takes the colour of its topic, in a lighter shade. |
| **Concept** | An idea in a concept map, with an optional colour. |
| **Note** | A free note. From the class catalog ([[class-catalog]]). |

| Relation class | From | To | Line |
| --- | --- | --- | --- |
| **Branch** | Central topic, Topic | Topic, Idea | A curved grey line without arrow. |
| **Link** | Central topic, Topic, Idea, Concept | The same | A dashed curved arrow with its **Label**. |
| **Annotates** | Note | Any other class | Dotted. |

## Where to find it

In the **General** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Team offsite" is `kits/mind-map/team-offsite.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Mind map**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place the **Central topic** in the middle and write the subject as its name ([[editing-labels]]).
4. Place a **Topic** for each main branch around it and connect it with **Branch**. Pick a **Colour** for each topic ([[attribute-panel]]).
5. Add **Ideas** around each topic and connect them with **Branch**; they take its colour at once.
6. Where two ideas on different branches are related, connect them with **Link** and write a **Label**.
7. For a concept map, make a model of the type **Concept map** instead, place **Concepts** and join them with labelled **Links**.

## Every option explained

### Colours

**Colour** offers Blue, Green, Orange, Purple, Red and Teal. Topics use the strong shade, ideas the light shade of the same colour. A topic or idea without a colour of its own, and no coloured topic above it, is grey.

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Branch colour** | Topic | Its own colour, or the branch colour of the topic it hangs from. |
| **Branch colour** | Idea | The branch colour of the topic it hangs from. |
| **Branches** | Central topic | How many topics branch from it. |
| **Ideas** | Topic | How many topics and ideas hang from it. |
| **Topics**, **Ideas** | Mind map | How many topics and ideas the map has. |

### Checks in the Problems panel

All are warnings ([[constraints]], [[model-types]]):

- a topic and an idea hang from something with **Branch**;
- a concept is linked to at least one other;
- a link has a label;
- a mind map has exactly one central topic.

### Model types

| Model type | Classes | Relation classes |
| --- | --- | --- |
| **Mind map** | Central topic, Topic, Idea, Note | Branch, Link, Annotates |
| **Concept map** | Concept, Note | Link, Annotates |

A concept map also has a **Focus question**: the question the map answers.

## Examples

The sample plans a team offsite in June. **Venue** is blue, **Agenda** green, **Travel** orange and **Budget** purple, and their ideas follow in lighter shades. A **Link** says that the budget *also pays for* travel, and a note about the dates annotates the central topic.

The sample shows no warnings.

## Good to know

- **One word or a short phrase per idea.** A mind map is for overview; put the detail in **Description**.
- **Change a branch colour in one place.** Change the colour of the topic and all its ideas follow.
- **An idea takes the colour of its first branch.** If an idea hangs from two topics, the first connection decides.
- **A crowded map** can be tidied with automatic layout ([[auto-layout]]); check the result, as it does not know which branch belongs on which side.

## Related

[[built-in-kits]] · [[org-chart]] · [[computed-values]] · [[constraints]]
