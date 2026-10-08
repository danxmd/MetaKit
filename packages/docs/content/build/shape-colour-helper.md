---
id: shape-colour-helper
title: Colour helper
category: build
summary: The "Colour by attribute" dialog writes the formula that gives a shape part a different colour for each value of a choice or yes/no attribute.
keywords: [colour helper, colour by attribute dialog, colour formula, colour for each value, colour per value]
contexts: []
order: 210
---

Writing a formula such as `if(Status == 'Done', ...)` by hand is tedious. The colour helper builds it from a small table: one colour per value.

## What it is

The helper is a dialog in the [[shape-editor]]. You pick an attribute and give colours to its values. When you press **Apply**, MetaKit writes the matching formula into the colour property of the selected part. You can open the dialog again later and it shows the table again, as long as the formula still has the exact form the helper writes (see below).

For a look made in the simple Appearance editor you do not need this; use [[appearance-data-rules]] there.

## Where to find it

In the properties panel ([[shape-properties]]), beside every colour property (**Fill colour**, **Line colour**, **Text colour**) there is a button **Colour by attribute...**. The dialog is titled "Colour ‹property› by attribute", for example "Colour fill colour by attribute".

## How to use it

1. Select a part in the shape editor.
2. Press **Colour by attribute...** beside the colour property.
3. Choose the **Attribute**.
4. Give a colour to each value in the table. Click the small swatch to pick one, or type a colour. Leave a value empty to give it no colour of its own.
5. Set the colour for **Anything else**.
6. Press **Apply**.

## Every option explained

| Control | What it does |
| --- | --- |
| **Attribute** | The attributes of the class that uses the shape which are a **Choice** or a **Yes or no** attribute. |
| Table | One row per value: the options of a choice in their order, or `true` and `false` for yes/no. Each row has a colour swatch and a colour text box (placeholder "no colour"). A new table starts with six distinct colours in turn: red, orange, green, blue, purple and grey. |
| **Anything else** | The colour for every other value and for an empty value. It starts as grey `#868E96`. |
| **Cancel** | Closes the dialog with no change. |
| **Apply** | Writes the formula. At least one value must have a colour, otherwise: Give at least one value a colour. |

If the class has no choice or yes/no attribute, the dialog says: "This class has no choice or yes/no attribute to colour by. Add one in Build mode first." and **Apply** is greyed out.

### The formula it writes

A chain of conditions with `?` and `:` that tests the attribute. For example, for Status with Done green and Failed red, and everything else grey:

```
= Status == 'Done' ? '#188038' : Status == 'Failed' ? '#D93025' : '#868E96'
```

Values without a colour are left out of the chain. You can read and change the formula in the properties panel after you apply it. The dialog can read back only formulas of exactly this form. If you rewrite it into another form, for example with `if(...)`, the dialog treats it as an ordinary formula and starts with a new table, and **Apply** would replace your formula.

## Examples

Give the stripe of a new Task shape a status colour. Select the stripe rectangle, press **Colour by attribute...** beside **Fill colour**, keep **Status** as the attribute and give colours to the rows in the order of the options: Planned, Ready, Running, Waiting for human, Done, Failed. Set **Anything else** to a neutral grey and press **Apply**. Change Running to a stronger blue and press **Apply** again: every running task changes at once.

The shipped shape **Task (status stripe)** of the Agent pipeline tool colours its stripe with a hand-written nested `if(...)` formula. Because that is not the form the helper writes, the dialog does not recognise it. Use it only as a model to rebuild.

To colour a text part: select it and use the button beside **Text colour**.

## Good to know

- The helper only handles one attribute per property. For two attributes, write the formula by hand with **fx** ([[shape-properties]]).
- Only choice and yes/no attributes are offered. For numbers or text use **fx** and a formula such as `= Effort > 10 ? '#D93025' : '#188038'`.
- The dialog is closed with Escape without a change.
- A colour that is not a valid text colour will show in the preview's problem list.
- The result is an ordinary formula, so renaming the attribute key rewrites it ([[keys-and-renaming]]).

> **Tip**
> Give the **Anything else** colour a neutral grey so that a value you forgot is easy to spot.

> **Note**
> The helper writes to the colour property of one part. To colour several parts the same way, use a named value ([[shape-properties]]).

## Related

[[shape-editor]], [[shape-properties]], [[appearance-data-rules]], [[formula-reference]], [[attribute-types]]
