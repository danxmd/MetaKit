---
id: panel-layout
title: Panel layouts
category: build
summary: A panel layout arranges the attributes of a class into tabs and groups, picks a control for each, and can show, hide, lock or require them depending on the data.
keywords: [panel layout, panel layout editor, attribute panel layout, tab and group layout, panel conditions, show the connected relations]
contexts: [build.panel-layout]
order: 110
---

A panel layout decides how the attribute panel looks for objects of one class. You choose the tabs, the groups, the order, the control of each attribute and the conditions under which an attribute is visible, read-only or required.

## What it is

Without a layout, the attribute panel in Model mode lists the attributes of an object in order, with a heading for each attribute group ([[attribute-panel]]). A layout replaces that with your own structure:

- **Tabs** at the top of the panel.
- **Groups** inside a tab, each with a heading.
- **Attributes**, in the order you choose, each with a control ([[field-types]]).
- **Conditions** that can be a fixed yes or no, or a formula ([[formula-reference]]).

A layout belongs to one class. It includes the attributes that class inherits from its parents ([[abstract-classes]]). Child classes do not use their parent's layout; give each class its own.

## Where to find it

In the editor of a class, in the **Appearance** block, press **Set up panel layout** (the first time) or **Edit panel layout** ([[classes]]). The layout opens over the whole Build view. The first time, MetaKit creates a layout with a single tab called **General** that holds every attribute in the current order. Attributes that share an attribute group are put into a group of that name.

## How to use it

1. Open the class and press **Set up panel layout**.
2. Click **Add tab** and give the tab a name. Click a tab row to select it and edit its **Name**.
3. Place attributes. The list **Not placed yet** shows attributes that are in no tab. Press **Add** beside one to put it at the end of the tab you used last.
4. Move things with **↑** and **↓**. Use **⇥** to move an attribute into the group next to it and **⇤** to move it out.
5. Click an attribute to open its details. Choose a **Control**, set a **Height (pixels)** for tables and text areas, and set conditions.
6. Press **Close**. Every change is saved the moment you make it, and appears at once in an open model ([[page-build-view]]).

## Every option explained

### Header

| Control | What it does |
| --- | --- |
| **Undo**, **Redo** | Step through the changes made in this editor. |
| **Close** | Goes back to the class. |

### Tabs

Each tab shows as **Tab: <name>**. Click it to select it.

| Control | What it does |
| --- | --- |
| **↑**, **↓** | Move the tab (greyed out at the ends). |
| **✕** | Removes the tab. Its attributes become unplaced; nothing is deleted from the class. |
| **Name** | Renames the tab. A tab needs a name: A tab needs a name. |
| **Visible** | A condition (see below). |
| **Add group** | Adds an empty group called "New group" at the end of the tab. |
| **Add tab** | Adds a tab called "New tab" at the end. |

### Groups

Each group shows as **Group: <name>**.

| Control | What it does |
| --- | --- |
| **↑**, **↓** | Move the group within the tab. |
| **✕** | Removes the group and keeps its attributes, which take its place in the tab. |
| **Name** | Renames the group. |
| **Visible** | A condition. |

A group cannot hold another group: A group cannot be placed inside another group.

### Attributes

| Control | What it does |
| --- | --- |
| **↑**, **↓** | Move within the tab or group. |
| **⇥** ("Move into the group next to it") | Moves the attribute into the group just above it, otherwise the group just below. Nothing happens if neither is a group. |
| **⇤** ("Move out of the group") | Moves it out, just after the group. |
| **✕** ("Remove from the layout") | Makes it unplaced. |
| **Control** | **Default** or one that suits the type. The list only offers suitable controls; see the table below. |
| **Height (pixels)** | Only for table attributes and text areas. A number above 0; empty means the default. |
| **Visible**, **Read only**, **Required** | Conditions. Tabs and groups only have **Visible**. |

Controls by attribute type:

| Type | Controls |
| --- | --- |
| Text | `text`, `textarea` |
| Whole number, Number | `number` |
| Yes or no | `switch`, `checkbox` |
| Date | `date` |
| Duration | `duration` |
| Choice | `select`, `segmented` |
| Choices | `chips` |
| Table | `table` |
| Reference | `reference` |
| Link | `link` |
| Date and time, Formula, Button | no choice; **Default** only |

### Conditions

A condition row shows the name, a checkbox and the word **Yes**, **No** or **Default**, and an **fx** button.

- **Fixed**: tick or untick the box. The word shows what is stored. **Default** means nothing is stored: visible is yes, read only is no, required is no.
- **Formula**: press **fx**. The box turns into a formula field. A formula starts with `=`, for example `= AgentKind == 'LLM agent'`. Press **fx** again to go back to a fixed value. A mistake is shown beside the field with its place.
- A condition is true, false or a formula starting with =. Other text is refused with that sentence.
- A formula is calculated for the selected object. If it cannot be calculated, or gives nothing, the default is used.

### Bottom of the editor

| Control | What it does |
| --- | --- |
| **Show the connected relations** | A setting stored in the layout for showing the connections of the selected object. The Model mode panel does not act on it yet. |
| **Not placed yet** | Lists attributes without a place. The note reads: These show up in a final tab called "More" until you place them. When all are placed it says "Every attribute is placed." |

## Examples

The Task class of the Agent pipeline tool has three tabs. **Overview** holds Name, Description (control `textarea`), Status (`select`) and Priority (`segmented`). **Effort** holds Effort, ActualEffort, Variance (a formula, always read-only) and EstimatedCost. **Quality** holds Criteria (`textarea`) and Checks (`table`, height 180).

The Agent class hides a field by a condition: ModelName has **Visible** set to the formula `= AgentKind == 'LLM agent'`. The field is shown only for LLM agents.

## Good to know

- **More tab.** An attribute that no tab places, for example one you add later, appears in a final tab called **More** in Model mode. Nothing is ever hidden by accident.
- **Mixed selections.** The layout applies when one object, or several objects of the same class, are selected. For a mix of classes, or for connections and objects, the normal panel is used.
- **Deleting and renaming.** Deleting an attribute removes it from the layout. Renaming a key updates the layout, including formulas in the conditions ([[keys-and-renaming]]).
- **Problems.** Items for attributes that do not exist, or that appear twice, are skipped when the panel is drawn. The first place is used.
- **Read-only.** A formula attribute or a button is read-only whatever the layout says, and a condition cannot make a required attribute optional.
- Only classes have a **Set up panel layout** button in the editor today.

> **Tip**
> Group related attributes in the class with the **Group** field first. The first layout then comes out already grouped.

> **Warning**
> Removing a tab does not delete attributes, but it moves them to **More** in Model mode until you place them again.

## Related

[[classes]], [[attributes]], [[attribute-types]], [[attribute-panel]], [[field-types]], [[formula-reference]], [[computed-values]]
