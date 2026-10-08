# Design

- `NodeLook` and `RelationLook` in `packages/core/src/meta/shape-types.ts`; `NodeShape.look?` and `RelationShape.look?`. The stored `parts` (or `line`) are the compiled form of the look, so the compiler, canvas and exports do not change.
- `packages/shapes/src/look.ts`: `nodeShapeFromLook`, `relationShapeFromLook`, `defaultNodeLook`, `defaultRelationLook`, `LOOK_BASES`, `LOOK_ICONS`. Colours are a fixed colour or `{ by: attribute, values, fallback }` and compile to the formula the colour helper already writes (`buildColourFormula`).
- Looks name attributes by key; when an attribute is renamed (`renameKey`) the look is updated with the shape formulas (`planKeyRename` rewrites `look` too) and the shape is regenerated.
- The Appearance editor (Build mode): left a gallery of base forms; right three groups, **Colours and border**, **Text and icon**, **Changes with data**. Above, the preview strip shows one tile per value of the driving attribute. A link "Edit as drawing" opens the advanced editor after a confirmation.
- Terms: "concept" and "relation" in the UI; "look" instead of "shape".
