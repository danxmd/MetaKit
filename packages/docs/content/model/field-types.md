---
id: field-types
title: Attribute field types
category: model
summary: Each kind of attribute has its own control in the panel, from plain text and numbers to switches, dates, durations, choices, tables, references, links and buttons.
keywords: [field types, attribute fields, segmented control, chips, table grid, duration field]
contexts: []
order: 220
---

The control you get in the [[attribute-panel]] depends on the type of the attribute. The type is set in Build mode (see [[attribute-types]]).

## What it is

A catalogue of every control, how to use it and what it accepts. Values are saved when you leave the control or choose an option.

## Where to find it

In the attribute panel, under each label. The same controls appear in designed panels and in generated ones.

## How to use it

1. Select an object.
2. Find the field by its label.
3. Use the control as described below.
4. If the field turns red, read the message under it and fix the value.

## Every option explained

| Attribute type | Control | How it works |
| --- | --- | --- |
| Text | One-line box | Type. Saved on **Enter** or when you leave. **Escape** restores the old value. Empty text clears the value. |
| Text, multi-line | Larger box | **Enter** adds a line. Saved when you leave the box. |
| Whole number, number | One-line box | Type digits. Spaces are ignored and `1,5` means 1.5. Unit is shown in brackets after the label. Rules such as minimum, maximum and decimals are checked. |
| Yes / no | Switch or checkbox | Click. Saved at once. |
| Date | Date picker | Pick or type a date. Clearing the box clears the value. |
| Date and time | Date and time picker | Pick a date and a time. |
| Duration | Three small boxes: **Days** (d), **Hours** (h), **Minutes** (min) | Type whole numbers, 0 or more. Saved on **Enter** or when you leave. |
| Choice (1 to 4 options) | Segmented buttons | Click an option. Click the selected one again to clear it, unless the attribute is required. |
| Choice (5 or more options) | Drop-down list | Pick one. The empty entry clears the value. |
| Several choices | Chips | Click chips to switch each on or off. Selected chips look pressed. |
| Table | Grid with **Add row** | See below. |
| Reference | Search box and list | See [[references]]. |
| Link | One-line box | Type an address. When it starts with `http://` or `https://`, an **Open link** link appears and opens it in a new tab. |
| Calculated (formula) | Read-only value | Cannot be edited. See [[computed-values]]. |
| Button | A button with the attribute's label | Runs a rule or script on the selected object. |

### Messages under a field

| Message | When |
| --- | --- |
| `"abc" is not a number.` | A number field contains text. |
| `This must be a whole number.` | A whole-number field has decimals. |
| `This must be at least 0.` / `This must be at most 100.` | A number is outside the allowed range. |
| `This must have at most 2 decimal places.` | Too many decimals. |
| `This is longer than 100 characters (it has 120).` | Text is longer than the limit. |
| `This does not match the pattern ...` | Text does not follow the required pattern. |
| `Use whole numbers, 0 or more.` | A duration box has a bad number. |

A value that breaks a rule is not saved until you correct it. A required attribute that is empty is not blocked, but the [[problems-panel]] lists it.

### Tables

A table is a small grid inside the panel. Its columns are set by the Kit.

- **Add row** appends an empty row. It is grey when the maximum number of rows is reached.
- **×** at the end of a row deletes that row. Its tooltip names the row, for example "Delete row 2".
- Cells have the control of their column: text box, number, checkbox for yes / no, date, or drop-down for a choice.
- Tab moves from cell to cell.
- You can paste from a spreadsheet. Click into a cell, then press **Ctrl+V** with copied cells (tab and line-break separated). The pasted block fills the grid from that cell, adding rows as needed.
- Paste problems appear under the grid, for example `Only 30 rows fit in this table; 5 extra rows were left out.` or `Row 2: there are more cells than columns; the extra cells were left out.`
- With several objects selected, a table shows "The selected objects have different tables." when they differ, and cannot be edited.

### Mixed values

With several objects selected, a field whose values differ shows a dash. Segmented buttons show "— differs" and chips show "— differs between the selected objects". Choosing a value sets it on all selected objects.

## Examples

A **Task** in the Agent pipeline shows: **Name** (text, required, max 100), **Description** (multi-line), **Status** (six options, a drop-down), **Priority** (three options, segmented), **Estimated effort** (number, unit h, one decimal, at least 0), **Variance** (calculated), **Acceptance criteria** (multi-line) and **Checks** (a table with columns **Check** and **Passed**, up to 30 rows). An **Agent** adds **Capabilities** (a two-column table) and a **Kind** choice. An **Artifact** has **Version** (whole number, at least 1) and **Location** (link).

## Good to know

- One edit of a field, even on several objects, is one undo step.
- The label of every field can be translated by the method engineer. See [[kit-settings]].
- Required fields show an asterisk.

## Related

[[attribute-panel]], [[references]], [[computed-values]], [[attribute-types]], [[problems-panel]]
