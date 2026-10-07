# Design

- Preferences: `ModelingAssist { hints: boolean; smart: boolean }` kept in localStorage (try/catch) next to the theme; a store with subscribe so the view updates at once. Surfaced in the model view as a "Model settings" menu (View menu entry "Assistance…" and a gear icon) with two switches and a one-line explanation each.
- `suggestConnections(tool, modelType, model, elementId, allowedRelationIds?)` uses `allowedRelations` from the canvas package for each pair of the element's class and each class of the model type (respecting views). Result: groups by relation with `out` and `in` classes and the existing elements that fit.
- Suggestion card: opens after a short hover delay on a concept, anchored beside it, never over a drag; closes on leave, Escape, or when a drag or the connect tool starts. Rows: "Performs → Task" with a small arrow for direction. Row actions: **New** (adds the class next to the concept at a free spot and connects, one undo step) and **Existing** (starts the connect tool with that relation fixed and highlights fitting targets).
- Hints: `hintFor(state)` returns a sentence for the current situation; the hint line sits under the canvas toolbar and shows only when hints are on.
- Highlights: the canvas view takes a set of element ids to outline in the selection colour, drawn on the overlay, so no scene redraw.
