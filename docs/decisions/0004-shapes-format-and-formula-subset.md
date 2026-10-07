# ADR 0004: shapes in the tool library, a small formula subset, and tool format 2

Status: accepted (phase 4). Settles three things the plan left open for work package 4.1.

## Context

Phase 4 stores shapes and panel layouts in the tool library and draws them. The plan says shape properties starting with `=` are formulas of the same language as computed attributes, but the formula engine is work package 5.1 and is not built. The two shape examples in the plan cannot render without conditionals, comparisons and attribute lookups.

## Decision

1. **Tool format 2.** `ToolLibrary` gets two tables: `shapes` (by `shp_` id) and `panels` (by class or relation id). Version 1 libraries are migrated by adding both as empty tables (migration `tool` 1 to 2, with a test). Version 2 files are not read by older releases, which refuse a higher version already.
2. **A formula subset now, the full language in 5.1.** `packages/formula` gets a parser and evaluator for: number, string, boolean and null literals, list literals, names (attribute keys, `let` names, `$label`, `$class`, `$width`, `$height`), `.` access, unary `!` and `-`, `* / %`, `+ -`, comparisons, `&& ||`, `?:`, and a fixed list of pure functions. Evaluation records every name it read, which is the dependency tracking the draw-list cache needs. Phase 5.1 extends the grammar and the function list; shapes keep working because they only use `evaluate` and `parse`. A formula that fails to parse or to evaluate gives `null` for that property and a message in the compile result, never an exception in the renderer.
3. **Images are data URIs or `assets/` paths.** Importing an SVG stores it as a data URI inside the shape, so a shape is one self-contained definition and needs no asset folder logic. `assets/<name>` paths are accepted and resolved through a hook the app provides; the workspace does not write asset files in this phase.
4. **The draw list is a flat list of operations** (`save`, `restore`, `clip`, `transform`, `rect`, `ellipse`, `polygon`, `path`, `text`, `image`) in element-local coordinates, with the list of names read and a polygon outline for connector attachment. The renderer replays it; tiny elements still draw only their outline in batches.

## Consequences

- A class without a shape gets a starter shape chosen from its kind and key (the phase 2 rules), so models of tools from phase 1 look as before.
- Layout (percentages, stack, grid) is done in the compiler, not in the renderer, so the same list works for canvas, minimap and later exports.
- The formula subset duplicates nothing of 5.1; it is its first slice. Names that a later release adds as functions do not break stored shapes, because unknown functions evaluate to `null` with a message.
