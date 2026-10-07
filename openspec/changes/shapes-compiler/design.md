# Design

- **Types live in core**, because the tool library contains them; the compiler lives in `packages/shapes`.
- **Values.** A property is a fixed value or a string starting with `=`. Dimensions are numbers or strings such as `"50%"`, `"100% - 22"`, `"12"`; a dimension formula yields a number or such a string.
- **Scope.** Names resolve in this order: `repeat` variables, `let` names (evaluated in order, each may use earlier ones), `$` names, attribute keys of the effective class attributes (with defaults). Reference values answer `.` access through a callback; without one, access gives `null`.
- **Compile.** `compileNode(shape, {w, h, values, resolve})` returns `{ops, hotspots, outline, reads, messages}`. `reads` are the names read from the attribute scope (not `let` or loop names). Width and height are the element size; parts lay out against their parent box.
- **Cache.** One entry per element holds the compiled list, the shape object it came from, w, h and the values it read. It is reused while the shape object is the same, the size is equal and every read value is deep-equal. A tool change replaces shape objects, so hot reload needs no extra signal.
- **Starter shapes** are plain shape definitions in `packages/shapes/src/starter.ts`; the Build mode gallery offers copies. `starterFor(classDef)` picks one for classes without a shape (the phase 2 rule by kind and key).
- **Relation shapes.** `compileRelation(shape, {values, resolve})` returns the line style, markers and label specs; the renderer places them along the route. `routing` is `straight` or `orthogonal` (the default); `curved` is drawn as a smoothed polyline.
- **Renderer.** Large elements replay their ops; elements smaller than the batch size keep drawing only their outline path in one batched fill.
- **Screenshot tests** render lists in a page with Canvas 2D at three sizes and compare to reference PNGs stored in the repository; the references are regenerated only on purpose (`UPDATE_SHAPE_SHOTS=1`).
