# Proposal

## Why

Danial: notation creation is far too complicated and does not make sense. Today a Kit builder draws a shape from layers (rectangles, text, formulas, `fx` buttons, sample values, SVG import), which is the mental model of a drawing program, not of "how should a Task look". Most notations need a handful of choices.

## What Changes

- A **simple look** for every concept and relation: pick a base form from a gallery (box, rounded box, pill, circle, diamond, hexagon, document, person, header box, container, swimlane), then choose colours, border, text, an optional icon, and **changes with data** ("fill depends on Status: Done is green, Failed is red"). The editor shows the result for every value of the attribute that drives it.
- A relation look: line colour, width and style (solid, dashed, dotted), routing, arrowheads for both ends, and a label from an attribute.
- The existing drawing editor stays as **Advanced**: opening a simple look in it turns the shape into a hand-drawn one (said clearly beforehand); hand-drawn shapes can be kept or replaced by a simple look.
- The look is stored in the shape (`look`), and the drawing parts are generated from it, so nothing else in MetaKit changes (compiler, canvas, exports, Git layout).
- Kit format 5 (adds the optional `look` to shapes), migration 4 to 5, test.
- Starter looks for new classes and relations: a new class already has a sensible look.

## Capabilities

### New Capabilities

- `simple-notation`

## Impact

- Format change: Kit format 5 (ADR 0009). Older Kits open unchanged; shapes without a `look` are hand-drawn shapes.
