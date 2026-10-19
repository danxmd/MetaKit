# Proposal

## Why

It is hard to tell which objects a relation can connect (issue #46). Three places describe a relation, and each says it differently: the palette card ("Performs: from Actor to Task", by label), the hint line ("Performs connects an Actor to a Task.", by key, own ends only) and the class catalog ("from Person, Team to any class"). All of them name the classes the Kit lists, often abstract ones such as **Actor**, which a modeller cannot place. The refusal message says "a Agent". In Build mode the From and To checkboxes do not say what the ticks mean or which classes an abstract class brings in. On the canvas nothing shows where a relation can start or end until the pointer is over an object, and the hint never moves on to "now choose the end".

## What Changes

**One description of what a relation connects**
- A shared helper in `packages/core` names the classes at each end as the concrete classes a modeller can place, by label: an abstract class is replaced by the classes that extend it, a class that others extend is named once, inherited ends are used, and in Model mode only classes the model type allows are named. It writes one sentence with "a" or "an": "Connects an Agent or a Human to a Task."
- The palette card, the hint line, the class catalog and the refusal message all use it. A long card sentence also comes as **From** and **To** lists.
- The refusal message reads "A "Performs" connector cannot go from an Agent to a Human in this model type. It connects an Agent or a Human to a Task."

**Build mode**
- The relation editor shows "Can connect: Agent or Human → Task" above the From and To lists, and each class that others extend says what it brings in ("means Agent or Human", "and User task"). Labels show beside keys when they differ.

**Model mode**
- With a relation chosen in the palette, every object where it can start gets a soft outline. Once you press on a start, the objects where it can end are outlined instead. Dragging from the edge of a selected object outlines the possible ends too.
- The hint line moves to its second sentence once the start is picked: "Let go on an outlined concept where the Performs should end."
- The hint for a class in the palette names the relations that can start or end at it, by inheritance and only those of the model type.

## Capabilities

### Modified Capabilities

- `ux-rework`: "Palette previews" says how a relation's ends are named.
- `canvas-tools`: "Connect only what fits" outlines the possible ends and the refusal says what the relation connects.
- `meta-model`: "Relation classes" gains how ends are described to people.

## Impact

- **Code:** `packages/core` (new `meta/ends.ts`), `packages/canvas` (`tools/relations.ts`, the editor and the active layer's new `ends` set), `packages/ui` (palette card, hints, suggestions, catalog dialog, relation editor, model view). Docs topics and e2e tests that quote the old wording.
- **No file format, command or storage change.**
- **No new dependency.**
- **Performance:** the outlined ends are worked out once per tool change, gesture start or scene change, in one pass over the elements with the answer kept per class; only those on screen are drawn.
