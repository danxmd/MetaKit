---
id: appearance-forms
title: Forms and colours
category: build
summary: The eleven forms of a simple look, how to choose colours with the colour control, and how the title, subtitle, listed lines and icon are set.
keywords: [look form, form gallery, rounded box, colour control, icon of a look, title and subtitle, colour palette]
contexts: []
order: 130
---

A simple look starts with a **form**, then colours, then text. This topic explains each of these controls in the [[appearance-editor]].

## What it is

The form is the outline and layout of an object: for example a rounded box for a task or a diamond for a decision. The colours, text and icon are placed on that form. You can change the form at any time without losing the colours and text.

## Where to find it

In the Appearance editor of a class: the **Form** gallery on the left, and the sections **Colours and border** and **Text and icon** on the right. Open it with **Edit appearance** in the class editor ([[classes]]).

## How to use it

1. Click a form in the gallery. Each tile is drawn with your current colours and text, so you can judge the choice.
2. Click the **Fill** swatch and pick a colour. Do the same for **Border**.
3. Choose what the **Title** shows. Add a **Subtitle** if you like.
4. Pick an **Icon** or **None**.
5. For a **Box with header**, tick the **Lines shown under the title**.

## Every option explained

### Forms

Each form has a default size. The size follows a new form only if you have not resized the look yourself.

| Form | Meant for | Default size |
| --- | --- | --- |
| **Rounded box** | A task, a step, most things. | 150 by 70 |
| **Box** | Square corners. | 150 by 70 |
| **Pill** | A state, a tag, a status. | 140 by 44 |
| **Circle** | An event, a start or an end. | 80 by 80 |
| **Diamond** | A decision or a gateway. | 90 by 90 |
| **Hexagon** | A checkpoint, a gate. | 120 by 70 |
| **Document** | A document, a file, an artifact. | 120 by 90 |
| **Person** | A person or a role. | 90 by 110 |
| **Box with header** | An entity or class that lists attributes. | 170 by 110 |
| **Container** | Holds other concepts, with a title. | 400 by 240 |
| **Swimlane** | A lane with its name on the left. | 600 by 160 |

New looks start with the rounded box (container and swimlane classes start with their own forms). A new look has a light blue fill (`#dbe4ff`), a blue border (`#4263eb`), border width 1.5 and a solid line. Containers and swimlanes start light grey (`#e9ecef`) with a grey border (`#868e96`); a container has a dashed border.

Changing the form keeps colours, text, icon and mark. Leaving **Box with header** removes its listed lines.

### Colours

Every colour field is made of a round **swatch**, a hex box and a palette.

| Part | What it does |
| --- | --- |
| Swatch | Shows the colour. Click it to open the palette. |
| Hex box | Type a code such as `#4263eb` or `#46e`. The `#` is optional and capitals are fine. A code that is not a colour marks the box as wrong and changes nothing. |
| Palette | Twelve named colours: White, Light grey, Dark grey, Black, Red, Orange, Yellow, Green, Teal, Blue, Indigo, Purple. **Fill** offers soft tones; **Border**, **Text colour** and marks offer stronger tones. |
| **Other** | The browser's own colour picker, for any colour. |

Escape closes an open palette without closing the editor.

### Title and subtitle

| Field | What it does |
| --- | --- |
| **Title** | **Name of the object** shows the label of the object. Or pick an attribute to show its value instead. Attributes of type Table and Button cannot be shown. |
| **Bold** | Makes the title bold. |
| **Text size** | **Small** (11), **Normal** or **Large** (17). |
| **Subtitle** | **None**, **Name of the object**, **Fixed text** or an attribute. Not available for the circle, diamond and swimlane, which have no room. |
| **Subtitle text** | Shown when the subtitle is **Fixed text**. |

The attribute list shows "Label (Key)" when the label differs from the key.

### Lines shown under the title

Only for the **Box with header**. Tick attributes to list them under the title, one line each. They stay in the order of the class. If the class has no attributes the note says "This concept has no attributes yet."

### Icon

Under **Icon**: **None** or one of fourteen small icons: Robot, Person, Document, Gear, Check, Warning, Star, Database, Cloud, Lock, Mail, Flag, Clock, Bolt. The icon is placed beside the text, or above it for the circle and diamond.

### Text colour

The default is **Automatic**. MetaKit chooses dark or light text depending on the fill. If the fill depends on an attribute, the fallback colour decides.

## Examples

Ideas for rebuilding the classes of the Agent pipeline Kit as simple looks:

- **Agent**: form **Person** with the icon **Robot**.
- **Gate**: form **Hexagon**, title **Name of the object**, subtitle from the attribute `Decision`.
- **Artifact**: form **Document**, subtitle from the attribute `ArtifactType`.
- **Stage**: form **Swimlane**, which is also what a class of the kind Swimlane starts with.
- **Task**: form **Rounded box**, with the fill following `Status` ([[appearance-data-rules]]).

The shipped Agent pipeline Kit draws these with hand-drawn shapes. The simple look reaches the same result in a few clicks.

## Good to know

- Light text on a dark fill is chosen for you. Untick **Automatic** only when you need a special colour.
- A smaller **Text size** helps in narrow forms such as the pill.
- Icons are drawn as simple line icons in the text colour.
- The form decides the corner setting: the corner field is shown only for box-like forms.

> **Tip**
> Keep two or three fills in a whole Kit. Colour is most useful when it carries meaning ([[appearance-data-rules]]).

> **Note**
> The gallery shows only forms. For anything it does not offer, such as a free polygon or an uploaded drawing, use the [[shape-editor]] and [[shape-svg-import]].

## Related

[[appearance-editor]], [[appearance-data-rules]], [[appearance-relations]], [[classes]], [[shapes-section]], [[shape-editor]]
