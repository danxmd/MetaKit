# ADR 0009: Simple looks and Kit format 5

Status: proposed (Danial to review)

## Context

The shape editor works like a drawing program: layers, rectangles, text parts, formulas behind `fx` buttons, sample values and SVG import. Danial found notation creation far too complicated. Kit builders think "a Task is a rounded box, blue, showing its name, red edge when High priority", not in layers.

## Decision

1. A concept or relation gets a **look**: a short, structured description (base form, colours that are fixed or depend on one attribute, border, text, icon, badge; for relations line style, ends, label).
2. The look is **stored in the shape** next to the drawing parts it generates. The compiler, canvas, exports, Git layout and sync keep working on parts; the look only adds a way to edit.
3. The drawing editor stays as the **Advanced** path. A shape edited as a drawing loses its `look` (after a confirmation), because parts can no longer be derived from it without loss.
4. **Kit format 5** adds the optional `look` to node and relation shapes. Migration 4 to 5 changes only the version number.
5. The editor says "concept", "relation" and "look" and shows every value of the driving attribute in the preview.

## Consequences

- Most notations need no formulas and no layers. Formulas remain for what only the drawing editor can do.
- Two representations of one shape exist; the look is the source of truth while it is present, and an edit as a drawing is a one-way step.
- Older Kits open as before; shapes without a look are hand-drawn.
