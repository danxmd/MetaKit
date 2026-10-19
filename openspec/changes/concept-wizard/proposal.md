# Proposal

## Why

Issue #48: there should be a wizard that walks the user through creating a class or relation step by step. It should be a pop-up that is also available in the model view.

Today a new class or relation class starts as a name typed into Build mode's **New** box:
- a class gets a default look and no attributes;
- a relation class has no ends, so the Kit shows a problem until both lists are ticked;
- neither is allowed in any model type, so modellers cannot use it until someone ticks it there too.

Someone drawing a model who misses a class has to leave the model, find all of this in Build mode, and come back.

## What Changes

**A wizard dialog, "New class" / "New relation class"**
- Four steps, with **Back** and **Next**:
  1. **Name**: a class or a relation class, the name, the key (made from the name: "Assigned to" becomes `AssignedTo`), a description, and for a class an optional parent and Abstract.
  2. **Look** (a class): object, container or swimlane, and for an object its form and its fill and border colours. **Connects** (a relation class): where a connection may start and end, the line style, end mark and colour.
  3. **Attributes**: rows of name, type (text, long text, whole number, number, yes or no, date, choice with one option per line) and Required. A class starts with a required Name.
  4. **Where and check**: the model types that allow it, and a plain summary of what will be made.
- **Next** lists what is missing on the step and does not go on until it is fixed. The last step also runs the whole Kit check on a copy and refuses only problems the new class would bring.
- Everything is added as **one batch** of Kit commands, so it is one undo step.

**Where it opens**
- **Build mode:** **Step by step…** under the New class and New relation class boxes. The new item is selected afterwards.
- **Model view:** **+ New class or relation…** at the bottom of the palette. The model's own model type is ticked. Afterwards:
  - the new class or relation class is picked in the palette, ready to place or connect;
  - a toast offers **Undo**, which is refused once the model uses the new class.

**Documentation**
- New topic "New class or relation, step by step" (`build/concept-wizard.md`, docs context `dialog.concept-wizard`).
- Classes, Relations and Palette mention it.

## Capabilities

### New Capabilities

- `concept-wizard`: the wizard, its steps and checks, and where it opens.

### Modified Capabilities

- `ux-rework`: "Modelling and Kit building are separate" gets one exception, the wizard in the model view (ADR 0014).

## Impact

- **Code** in `packages/ui`:
  - `build/concept-wizard.ts`: the pure model with unit tests.
  - `components/build/ConceptWizard.svelte`: lazy-loaded.
  - `BuildView.svelte`, `ModelView.svelte`.
  - `shell/controller.ts`: `runKit` and `undoKit` on the open model's Kit store.
- **ADR 0014** records why the model view may now change the Kit, and only through this batch.
- **No file format, command or storage change.** It uses the existing Kit commands (`putShape`, `putClass`, `putRelation`, `putModelType`).
- **No new dependency.** The dialog is a lazy chunk, so the start-up download does not grow.
