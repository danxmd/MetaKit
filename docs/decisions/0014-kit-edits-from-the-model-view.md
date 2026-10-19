# ADR 0014: Adding to the Kit from the model view

Status: accepted (Danial chose it for issue #48, 2026-10-19)

## Context

Issue #48 asks for a wizard that walks a person through a new class or relation class, "also available in the model view". Until now the model view never changed the Kit. A model follows its Kit's changes live (`Controller.kitChanged`), but the Kit is only edited in Build mode, and the ux-rework spec says "Modelling and Kit building are separate".

Danial had three options:
- the wizard changes the Kit directly from the model view;
- the wizard hands over to Build mode with the new class made;
- the wizard exists only in Build mode.

He chose the first.

## Decision

1. **The wizard is the only way the model view changes the Kit.** It ends with one batch of Kit commands, made by `wizardCommands` in `packages/ui/src/build/concept-wizard.ts`:
   - `putShape` for the look;
   - `putClass` or `putRelation`;
   - `putModelType` for each model type that should allow it.

   Build mode and the model view run the same batch, so a class made in either place is the same.
2. **Through the Kit's own store.** `Controller.runKit` executes the batch on the open model's Kit store, the one the model already listens to (rule 3: commands are the only way to change state). The change is written as this instance's change files and synced like an edit in Build mode (rules 2 and 6). The model sees the new Kit through `kitChanged`. No new storage path, format or command.
3. **Checked before it runs.** The wizard checks the key and each step itself. It then applies the batch to a copy of the Kit and refuses only problems that the batch would add (`validateKit` before and after). A Kit that already had problems is not blocked by them.
4. **One undo step, offered once.** The toast after adding has Undo, which calls `Controller.undoKit` (the Kit store's undo). The model view refuses that Undo when the model already uses the new class or relation class, because removing it would leave objects of a class that does not exist. Anything later is changed or removed in Build mode, which has the full Kit undo history and the usage checks.
5. **Build and Model stay separate areas.** The top bar, the pages and every other Kit editor stay in Build mode. The ux-rework requirement is changed to say the wizard is the one exception.

## Consequences

- A modeller can add to the Kit, which changes every model of that Kit for everyone in the folder. The wizard's last step says so.
- Kits shared read-only have no protection here beyond what Build mode has. Build mode does not stop edits either; Git-linked Kits show the change in their next commit.
- There is no Kit undo history in the model view beyond the toast. That is on purpose: Kit history and usage checks belong to Build mode.
