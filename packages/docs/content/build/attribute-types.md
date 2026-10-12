---
id: attribute-types
title: Attribute types
category: build
summary: The fourteen attribute types, what each one stores, and every setting its form offers.
keywords: [attribute type, text attribute, choice attribute, formula attribute, table attribute, reference attribute, button attribute, link attribute, multi-choice]
contexts: []
order: 50
---

Every attribute has a type. The type decides what a modeller can enter, which control the attribute panel shows ([[field-types]]) and which extra settings you can set here.

## What it is

There are fourteen types. You choose the type once, when you add the attribute ([[attributes]]). It cannot be changed later. The settings below appear in the attribute form when you open an attribute. All types also share the settings **Key**, **Label**, **Help text**, **Required**, **Group** and (except Formula, Table and Button) **Default formula**.

## Where to find it

In the **Attributes** block of a class, relation class or model type: open an attribute by clicking its row. The type list next to **Add attribute** has these entries: Text, Whole number, Number, Yes or no, Date, Date and time, Duration, Choice (one of a list), Choices (several of a list), Formula (calculated, read-only), Table, Reference to another object, Button that runs something, Link.

## How to use it

1. Choose the type that matches the real data. Use **Choice** instead of free text when the answer comes from a short list.
2. Add the attribute and open it.
3. Set the options listed for that type below.
4. Look at the [[try-it-preview]] or a real model to see the field.

## Every option explained

Values in dates and durations follow the ISO 8601 form. Where a default is allowed it must fit the type, or the change is refused with a message such as "The default is not a valid date."

### Text

Free text.

| Setting | Meaning |
| --- | --- |
| **Several lines** | A larger text area instead of one line. |
| **Longest** | The most characters allowed (at least 1). A longer value is reported as "is longer than 10 characters (it has 11)". |
| **Pattern (regular expression)** | A regular expression the value must match. An invalid pattern is refused: The pattern "..." is not a valid regular expression. A value that does not match is reported as "does not match the pattern ...". |
| **Default** | The starting value. |

### Whole number

Integers only.

| Setting | Meaning |
| --- | --- |
| **Smallest**, **Largest** | Limits. If the smallest is above the largest the change is refused: The minimum (10) is above the maximum (5). |
| **Default** | The starting value. |

A value with decimals is reported as "must be a whole number".

### Number

A number that may have decimals. It has **Smallest**, **Largest** and **Default** like a whole number, and:

| Setting | Meaning |
| --- | --- |
| **Decimals** | How many decimal places at most (0 to 10 in the form). A value with more is reported. |
| **Unit** | A short text shown with the value, for example `h`, `kg` or `EUR`. |

### Yes or no

True or false.

| Setting | Meaning |
| --- | --- |
| **Shown as** | **Checkbox** or **Switch**. |
| **Yes by default** | New objects start with yes. |

### Date, Date and time, Duration

Three types for time values. Each has only a **Default**. The form shows the expected shape: a date is `2026-10-07`, a date and time is `2026-10-07T09:30:00Z`, a duration is `PT90M` (90 minutes) or `P1DT2H`. For "today" use the **Default formula** `today()` ([[formula-reference]]).

### Choice (one of a list)

One value from a list.

| Setting | Meaning |
| --- | --- |
| **Options, one per line** | Type one option per line. Empty lines and repeated values are dropped. A new Choice starts with Option A and Option B. At least one option is required. |
| **Default** | One of the options. |

To give an option a label in your first language, write the value, a vertical bar and the label on one line, for example `Done | Finished`. The stored value is the text before the bar.

Choice attributes can drive looks: a colour or mark can follow each option ([[appearance-data-rules]]).

### Choices (several of a list)

Several values from a list. It has **Options, one per line** as above, plus **At least** and **At most** (how many may be picked). A value that is not an option, a duplicate, or too few or too many picks is reported.

### Formula (calculated, read-only)

A value that MetaKit works out from other attributes.

| Setting | Meaning |
| --- | --- |
| **Formula** | For example `Effort * 85`. Names in the formula are attribute keys of the same object. A new formula attribute starts as `0`. |
| **Result is** | **Any**, **Text**, **Number**, **Yes or no** or **Date**. A hint for what the formula gives. |

A formula attribute is never typed in by a modeller and has no default. It is recalculated when what it reads changes ([[computed-values]]). The Task class has `Variance` = `(ActualEffort ?? 0) - (Effort ?? 0)`. Formulas are explained in [[formula-reference]].

### Table

Rows of values with named columns, such as the Checks table on a Task.

| Setting | Meaning |
| --- | --- |
| **Columns** | Each column has a key (the box with the label "Column key"), a type (**Text**, **Whole number**, **Number**, **Yes or no**, **Date**, **Choice**) and a **Remove** button. The last column cannot be removed. A new table starts with a text column `Column1`. Column keys must be unique. |
| **Add column** | Adds `Column2`, `Column3` and so on. |
| **Most rows** | The most rows a modeller may add (at least 1). |

> **Note**
> The Build form does not yet edit the options of a **Choice** column. A choice column without options is refused. Use **Text** columns, or a Choice attribute outside the table.

### Reference to another object

Points to other objects ([[references]]).

| Setting | Meaning |
| --- | --- |
| **Can point to classes** | Tick the classes whose objects may be chosen; their subclasses count too. None ticked means any class. |
| **In models of type** | Tick the model types whose models may be searched. None ticked means models of every type in the workspace. |
| **At most N references** | How many references are allowed (at least 1). Empty means no limit. A longer list is reported as "allows at most 2 references (it has 3)". |

### Button that runs something

Shows a button in the attribute panel instead of a value.

| Setting | Meaning |
| --- | --- |
| **Runs a** | **command**, **rule** or **script**. |
| **Name** | What to run. A new button starts as the command `open`. For a rule or script use its id (they start with `rule_` and `scr_`); for a command use its id or label. See [[rules]], [[scripts]] and [[behaviour-commands]]. |

A button has no default and holds no value.

### Link

A web address or a file.

| Setting | Meaning |
| --- | --- |
| **Points to** | **A web address or a file** (the default), **A web address** or **A file in the workspace**. A web address must start with `http://` or `https://`. A file must be a path inside the workspace, such as `assets/plan.pdf`, without `..` and without a drive or scheme. |
| **Default** | Not set in the Build form. |

## Examples

In the Agent pipeline Kit: **Name** is Text (required, default "New task"); **Status** is a Choice with Planned, Ready, Running, Waiting for human, Done and Failed; **Effort** is a Number; **Version** on Artifact is a Whole number with default 1; **Location** on Artifact is a Link; **Checks** on Task is a Table; **Variance** is a Formula; **AgentKind** and **Autonomy** on Agent are Choices shown as segmented buttons by the panel layout.

## Good to know

- Choose the type carefully. The only way to change it is to delete the attribute and add a new one, which loses the values in models (they stay as unknown attributes).
- Reference, Formula and Button attributes have no default value.
- Only types **Choice**, **Yes or no**, **Text**, **Whole number** and **Number** can drive a colour or a mark in a look.

> **Tip**
> To see how a type looks to a modeller, add it to a class and place the class in the [[try-it-preview]].

## Related

[[attributes]], [[field-types]], [[formula-reference]], [[constraints]], [[panel-layout]], [[appearance-data-rules]], [[references]]
