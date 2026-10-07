# Design

- **One command per gesture.** A drag shows a preview on the active layer and executes one `batch` of `move` commands on pointer up, so one undo reverses it. Resize, bend and reconnect work the same way. Nothing writes to the store during the gesture.
- **Clipboard.** Copy serialises the selected elements, their attribute values and the connectors between them to a plain JSON object (`kind: "metakit-clipboard"`), held in memory and written to the system clipboard as text. Paste creates new elements with new ids at an offset, mapping classes by id when the tool is the same and by key otherwise; items whose class is not allowed in the target model type are skipped and counted.
- **Connecting.** `allowedRelations(tool, modelType, fromClass, toClass)` uses `effectiveEnds` and `isA` from core. Dragging from an object's edge picks the single relation that fits when there is one and offers a menu when there are several; dropping on an object that no relation fits shows a refusal reason and creates nothing.
- **Snapping.** Snap candidates (edges and centres of nearby elements) come from the index; grid snap rounds to `tool.settings.grid.size`. Guides show on the active layer.
- **Align and distribute** take the selection and return move commands.
- **Minimap** is a small canvas drawing the element boxes scaled, with the viewport rectangle; clicking or dragging it moves the view.
- **Keyboard.** Delete, Ctrl/Cmd+A, C, X, V, Z, Shift+Z or Y, arrows (nudge by grid), Escape.
