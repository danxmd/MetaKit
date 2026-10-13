---
id: kit-catalogue
title: Kit catalogue
category: pages
summary: Browse the built-in Kits by domain, see a picture of each Kit's sample model, and use or copy the one you want.
keywords: [catalog, browse built-in kits, sample model, sample model picture, preview, categories, all kits, open full size]
contexts: [dialog.kit-catalogue]
order: 36
---

The Kit catalogue is where you choose a built-in Kit. It lists them by domain and shows a picture of what a model made with each Kit looks like, so you can pick one by what you will draw rather than by its description alone.

## What it is

A large dialog titled **Built-in Kits**, with a search box and a close button at the top and three columns below:

- **Categories** on the left: **All Kits** and the five domains **Data and AI**, **Business and strategy**, **Delivery**, **Architecture** and **General**, each with the number of Kits in it ([[built-in-kits]]).
- **The Kits** of the chosen category in the middle. Each row shows a small picture of the Kit's sample model, its name, and the start of its description. **✓ In this workspace** marks a Kit the workspace already has.
- **The preview** on the right, for the chosen Kit:
  - a large picture of its sample model;
  - for a Kit with several samples, one tab per sample, named by its model type. Data modelling, for example, has a conceptual, a logical and a physical data model;
  - the Kit's name, version and description, and its model types, classes and relation classes;
  - the buttons **Use in this workspace** and **Copy and extend…**.

The pictures are drawn from the sample models with the Kit's own shapes, the same way the canvas draws them. They always sit on white, as in an exported picture, because the Kits' colours are chosen for a light background.

## Where to find it

On the [[page-kits|Kits page]], under **Built-in Kits**:

- **Browse built-in Kits** opens the catalogue at **All Kits**.
- A domain, for example **Architecture 5**, opens it at that domain.

## How to use it

**Find a Kit**

1. Choose a category on the left, or type into **Search all Kits**. The search looks in every category and matches the name and the description; every word you type must appear.
2. While you search, each row says which domain the Kit is in. With no match the list says "No built-in Kit matches." Clear the box to go back to the category.
3. Choose a row to see its preview.

**Look at the sample models**

1. When the preview has tabs above the picture, choose a tab to see another sample.
2. Choose **Open full size** to see the picture at its real size and scroll around it. **Fit to the box** makes it fit again.

**Use a Kit as it is**

1. Choose **Use in this workspace**. The Kit is added to the workspace unchanged, with its own id and version, and the preview and its row now say **✓ In this workspace**.
2. Close the catalogue. The Kit is listed under **In this workspace** on the Kits page, and you can make models with it.

**Copy a Kit and extend it**

1. Choose **Copy and extend…**. The catalogue closes and the **New Kit** dialog opens with this Kit under **Start from**.
2. Type a name and choose **Create and edit** ([[page-kits]]).

## Every option explained

| Control | What it does |
| --- | --- |
| **Search all Kits** | Shows the Kits whose name or description holds every word typed, from all categories. Case does not matter. `Escape` closes the catalogue. |
| **✕** | Closes the catalogue. A click outside it does the same. |
| Category (**All Kits**, a domain) | Lists the Kits of that category. The number is how many it holds. |
| Kit row | Chooses the Kit and shows its preview. |
| Sample tabs | Shown when a Kit has more than one sample model; each shows one sample. |
| **Open full size** / **Fit to the box** | Shows the picture at its real size, or fitted to the box. |
| **Sample: …** | The name of the sample model in the picture. |
| **Model types**, **Classes**, **Relation classes** | What the Kit defines, in alphabetical order. |
| **Use in this workspace** | Adds the Kit unchanged. When the workspace already has it, **✓ In this workspace** is shown instead. |
| **Copy and extend…** | Closes the catalogue and opens the **New Kit** dialog with this Kit chosen. |

**Keyboard.** With a category focused, `↑` and `↓` move between categories. With a Kit focused, `↑` and `↓` choose the previous or next Kit, and `Enter` moves to its first button. `Escape` closes the catalogue and returns to the control that opened it.

**When a picture cannot be drawn,** the preview says "No preview for this Kit." The rest of the catalogue keeps working, and the Kit can still be used or copied.

## Examples

Ben models software and wants to see the choices. He chooses **Architecture 5** on the Kits page. The catalogue opens with ER lite, Enterprise architecture, Software architecture (C4-style), Event storming and Security threat model, each with a small picture. He chooses **Software architecture (C4-style)**, chooses **Open full size** to read the sample's labels, and chooses **Use in this workspace**.

Priya types "lineage" into the search. Data and AI architecture and Data pipelines and lineage are listed, each marked **Data and AI ·**. She chooses **Copy and extend…** on Data pipelines and lineage, names the copy "Our lineage", and it opens in Build.

## Good to know

- **Nothing loads until you look.** The catalogue and each Kit's files load the first time they are shown, so the app starts as fast as before.
- **The samples are not added** when you use a Kit. To start a model, choose **New model** on the [[page-models|Models page]] with that Kit.
- Your workspace's own Kits are not in the catalogue; they stay as cards on the Kits page.

## Related

- [[built-in-kits]]
- [[page-kits]]
- [[concepts-kit]]
