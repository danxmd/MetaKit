---
id: appearance-data-rules
title: Look that changes with data
category: build
summary: Make a fill, border or text colour, or a small mark on the corner, follow the value of an attribute, and check every state in the preview tiles.
keywords: [colour by attribute, data driven colour, colour rule, corner mark, badge, preview tiles, anything else colour]
contexts: []
order: 140
---

A look can change with the data. A Task can turn green when it is Done and red when it Failed. A mark can appear when its Priority is High. You set this under **Changes with data** in the [[appearance-editor]], without any formula.

## What it is

A data rule connects one attribute to one colour. For each value of the attribute you give a colour, and one more colour for **Anything else**. MetaKit writes the formula for you. When a modeller changes the value, the object redraws at once ([[computed-values]] explains how derived values stay up to date).

You can make three colours depend on data: **Fill colour**, **Border colour** and **Text colour**. In addition you can show one **mark on the corner** for one value.

## Where to find it

In the Appearance editor of a class, in the section **Changes with data**. The text there reads: "Let a colour or a mark follow the value of an attribute. The tiles under the preview show every value." The class needs at least one attribute of a suitable type.

## How to use it

1. Open **Edit appearance** for the class ([[classes]]).
2. Under **Changes with data**, find **Fill colour depends on** and choose an attribute, for example **Status**.
3. A table appears with one row per value and an **Anything else** row. Click each swatch to pick a colour. New rows start with a different soft colour each.
4. To switch it off, choose **nothing (always the same)**. The fill goes back to a single colour, the one that was **Anything else**.
5. For a mark, tick **Show a mark on the corner** and fill in the sentence.
6. Click the tiles under the preview to look at each state.

## Every option explained

### Which attributes can drive a look

Attributes of type **Choice**, **Yes or no**, **Text**, **Whole number** and **Number** appear in the list. **Choices**, **Table**, **Formula** and others do not.

### The colour rules

| Control | What it does |
| --- | --- |
| **Fill colour depends on** / **Border colour depends on** / **Text colour depends on** | Choose **nothing (always the same)** or an attribute. |
| Value rows | For a **Choice** there is one row per option, in order. For a **Yes or no** attribute there are two rows, **Yes** and **No**. Each row has a colour control ([[appearance-forms#colours]]). |
| **Anything else** | The colour for every other value, including an empty one. Always present. |
| **A value to colour, for example Urgent** + **Add value** | Only for Text, Whole number and Number attributes, which have no fixed list. Type a value, for example `Urgent`, and press **Add value**. Added values have a **Remove** button. |

When the fill depends on data, the **Fill** line under **Colours and border** shows "Depends on Status (see Changes with data)". The same happens for **Border**.

### The mark on the corner

| Control | What it does |
| --- | --- |
| **Show a mark on the corner** | Turns the mark on or off. Greyed out when the class has no suitable attribute: "Add an attribute to the concept to use this." |
| *when* [attribute] *is* [value] | Pick the attribute and the value that shows the mark. A choice or yes/no attribute gives a list of values. Other types give a text box. |
| **Mark text** | Up to six characters, for example `!` or `High`. It follows the value until you change it yourself. |
| **Colour** | The colour of the mark. A new mark is red. |

One look has at most one mark.

### The preview tiles

Under the large preview there is a row of tiles. Each tile shows the look for one state.

- A look that does not change has one tile, **Sample**.
- If it depends on data, you see a group for each attribute it uses (up to three), titled with the attribute's name. Each group has one tile per value. For attributes without a list of values the last tile is **Anything else**.
- Click a tile to see it large. The tile in focus is marked as pressed.

## Examples

The shipped **Task** shape of the Agent pipeline tool colours a narrow stripe by Status. You can colour the whole fill with a data rule using the same colours:

| Status | Colour |
| --- | --- |
| Planned | light grey (`#f1f3f5`) |
| Ready | light yellow (`#fff3bf`) |
| Running | light blue (`#d0ebff`) |
| Waiting for human | light orange (`#ffe8cc`) |
| Done | light green (`#d3f9d8`) |
| Failed | light red (`#ffe3e3`) |
| Anything else | light grey (`#f1f3f5`) |

Add a mark: **Show a mark on the corner**, when **Priority** is **High**, **Mark text** `!`, colour red. The preview then shows two groups of tiles, one titled Status with six tiles and one titled Priority with three (Low, Medium, High).

The shipped shape ("Task (status stripe)") is hand-drawn and gets its stripe colour from a long `if(...)` formula. A data rule does the same job without writing a formula.

## Good to know

- A colour rule needs the attribute key. If you rename the key, the rule follows ([[keys-and-renaming]]).
- If a modeller picks a value you have not given a colour, the **Anything else** colour is used.
- If you delete the attribute a rule depends on, check the look afterwards and the problems banner ([[tool-validation]]).
- The hand-drawn [[shape-editor]] has a similar helper, the [[shape-colour-helper]].
- For relation classes, the line colour can depend on data too ([[appearance-relations]]).

> **Tip**
> Colour by one attribute only. Too many colour rules make a diagram hard to read. Use the mark for a second signal.

> **Note**
> Only the displayed colour changes. The data itself stays as it was.

## Related

[[appearance-editor]], [[appearance-forms]], [[appearance-relations]], [[attribute-types]], [[shape-colour-helper]], [[computed-values]]
