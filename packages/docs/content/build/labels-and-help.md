---
id: labels-and-help
title: Labels, help text and languages
category: build
summary: Labels and help texts are the words modellers read; each can be given per language, while the key stays the same.
keywords: [labels per language, help text, translated labels, label fields, tool languages]
contexts: []
order: 75
---

Labels and help texts are what modellers see. You can write them in every language of the tool library. The key never changes with the language.

## What it is

Many things in a tool library have a **Label** and some have a **Help text**: classes, relation classes, model types, attributes, views and options of a choice. Help text can be edited for classes, model types and attributes. Each is a small group of text boxes, one for every language you listed in [[tool-settings]]. The code of the language (`en`, `de`) is shown beside its box.

## Where to find it

- **Label** and **Help text** in the **Identity** block of a class or model type, and **Label** in the **Identity** block of a relation class ([[classes]], [[relations]], [[model-types]]). The relation class editor has no help text box yet.
- **Label** and **Help text** in the form of an open attribute ([[attributes]]).
- **Label** for each view in a model type.
- Option labels inside the **Options, one per line** box of a choice attribute, as `value | Label` ([[attribute-types]]).

## How to use it

1. Add the languages you need in **Settings > Languages** ([[tool-settings]]).
2. Open the item and type its label in every language box. Leave a box empty for a language you do not need.
3. Optionally write a help text. It can be several lines long.
4. Leave the box (click elsewhere or press Tab). The text is saved when the box loses focus.

## Every option explained

| Thing | Where it is shown to modellers |
| --- | --- |
| Class label | The palette and the palette preview. |
| Class help text | The palette preview that appears when the pointer rests on the class ([[palette-preview]]). |
| Relation class label | The palette and the palette preview. |
| Model type label | The list when creating a model. |
| View label | The view switcher of the model. |
| Attribute label | The name of the field in the attribute panel ([[attribute-panel]]). |
| Attribute help text | A tooltip on the field name and a line under the field. |
| Option label | The choice list instead of the stored value. |

### Which language is shown

Both Build mode and Model mode show the **first language** in the Settings list. If a label has no text in that language, MetaKit falls back to English where it can and then to the key. The other languages are stored with the tool library so that you can fill them in now; there is no per-person language switch yet. The order is the order of the list in **Settings > Languages**; a new language is added at the end.

### Rules

- A class, relation class, model type or view must have a label in at least one language. A missing label is reported as "The class labels needs a label in at least one language." in the problems banner ([[tool-validation]]).
- An attribute label is optional. Without one, the key is shown.
- A label for a language that is not in the list is reported as: The language "de" is not listed in the tool's languages (en).
- An empty box removes that language from the label. It does not store an empty text.
- Help text is optional everywhere. If you clear every box, the help text is removed.

## Examples

The Agent pipeline tool has the single language `en`. The relation class with the key `HandsOverTo` has the label "Hands over to", so the palette says "Hands over to". The model type with the key `ArtifactLineage` has the label "Artifact lineage". Adding the language `de` in Settings gives every label a second box where "Task" could become "Aufgabe".

## Good to know

- Changing a label never changes formulas, rules or scripts. Only keys do ([[keys-and-renaming]]).
- Labels travel with the tool library, so every language you fill in is kept for later.
- Choice option values are stored, so renaming an option changes the value, not only the label. Use `value | Label` when you want the stored value to stay stable.

> **Tip**
> Write the label for the first language right after you create something, so the lists in the Build view are easy to read.

> **Note**
> The **New class** box fills in the first language for you: the text you type becomes the label.

## Related

[[tool-settings]], [[keys-and-renaming]], [[classes]], [[attributes]], [[attribute-types]], [[model-types]]
