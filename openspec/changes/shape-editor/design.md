# Design

- **Editing model.** The editor works on a draft of one shape and commits it with `putShape` when the user saves or after each change (so hot reload works); every edit is a pure function `Shape -> Shape` in `packages/shapes/src/edit.ts` (add, remove, reorder, move, resize, set property, group, ungroup), unit-tested.
- **Canvas.** A small dedicated Canvas 2D view (not the model canvas) draws the compiled list of the draft with selection handles; hit testing and resizing use part boxes resolved against the shape size.
- **Properties panel.** One row per property, with a fixed-value control and an *fx* toggle; the formula field completes attribute keys, `let` names and `$` names from the class the shape is previewed for.
- **Colour by attribute.** The helper takes an attribute (choice or boolean) and a colour per value and produces `= Key == 'A' ? '#..' : Key == 'B' ? '#..' : '#default'`, and can read it back to edit; a formula that is not of that form shows as a plain formula.
- **Preview.** Three previews at 0.5x, 1x and 2x of the shape size, with a row of sample values the user can edit (one control per attribute of the previewed class).
- **SVG import.** `importSvg(text, mode)` converts `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path` and `text` with solid fills, strokes and simple transforms into parts (`mode: 'parts'`), or wraps the whole file as one `image` part with a data URI (`'image'`). Unsupported elements are listed in a message. Scripts and external references are never imported.
- **Gallery.** The starter shapes of 4.1, copied with new ids.
