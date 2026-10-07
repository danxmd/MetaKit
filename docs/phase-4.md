# Phase 4: Build mode and Shapes (lane A, weeks 8 to 12)

Phase 4 builds Build mode, where method engineers create modelling tools without writing code, and the Shapes system that replaces GraphRep. At the end of this phase MetaKit reaches the usable v0.5 milestone (week 12): a tool can be built, used for modelling, and shared through a synced folder.

**Before starting:** plan sections "Notation: Shapes replace GraphRep", "Attribute panels replace AttrRep", "Meta-model and file formats".

**Dependency:** shape properties bound to attributes need the formula engine from work package 5.1. Start with fixed values; add `=` bindings once 5.1 is merged.

## 4.1 Shape format and compiler (`packages/shapes`)

Deliver:

- The shape JSON format from the plan:
    - node shapes: `size`, `outline`, `let`, and parts `rect`, `ellipse`, `polygon`, `path` (SVG path syntax), `text`, `image`, `group`;
    - per part: `visible`, `tooltip`, `onClick`, `fill`, `stroke`, `shadow`, `font`, `clip`, `transform`;
    - layout: percentages and offsets (`"100% - 22"`), `repeat` with `stack` or `grid`;
    - `variants` chosen by a formula, `use` for shared sub-shapes;
    - relation shapes: `line` (stroke, width, dash, routing, corners), `startMarker`, `endMarker`, `labels` at start, middle or end.
- A compiler from shape plus element state to draw lists, recording which attributes each shape reads (for cache invalidation).
- Replacement of the phase-2 built-in shapes by starter shapes written in this format.

Done when: the two complete shape examples in the plan render correctly in screenshot tests at three sizes.

## 4.2 Build mode editors (`packages/ui`)

Deliver:

- Tool library list: create, rename, version, delete.
- Class editor: key, labels per language, kind, parent, abstract, help text, attributes with type, options, default and constraints.
- Relation class editor: FROM/TO lists, attributes, line shape.
- Model type editor: allowed classes and relations, views, cardinalities, model attributes, background shape.
- Renaming a key rewrites the formulas and rules that use it.
- Hot reload: saving any definition refreshes open models within 1 second.
- Tool changes and existing models: removed attributes keep their values in an "Unknown attributes" group; removed classes render as grey placeholders.

Done when: the sample tools from phase 1 can be recreated entirely in Build mode.

## 4.3 Shape editor (`packages/ui`)

Deliver:

- A canvas to draw parts, a layer list, a properties panel.
- An *fx* switch on every property, turning a fixed value into a formula with attribute-key autocomplete.
- A "Colour by attribute" helper that builds a value mapping without typing a formula.
- A preview strip with sample attribute values at three sizes.
- SVG import (as parts or as one image) and a starter gallery (BPMN task, gateway, event, UML class, ER entity).

Done when: a shape like the plan's task example can be built without typing JSON.

## 4.4 Panel layouts, containers and swimlanes

Deliver:

- A panel layout editor: tabs, groups, order, control overrides, and `visible`, `readOnly`, `required` as fixed values or formulas; `showRelations`.
- Containers and swimlanes in Model mode: dropping an object inside sets its parent, moving the container moves its children, swimlanes resize to fit, and a model type can limit which classes a container accepts.

Done when: a non-programmer builds a small ER tool, with notation and panels, in under an hour in a usability test that Danial runs.

## Out of scope

Rules and scripts (phases 5 and 7), exports and tool packages (phase 6).
