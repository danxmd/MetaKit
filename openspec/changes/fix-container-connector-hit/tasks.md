# Tasks

- [x] 1. `Scene.itemAt(point, tolerance)`: the topmost item in drawing order (object, connector, container). Unit test in `scene.test.ts` with nested lanes.
- [x] 2. Editor: pointer down, double click and the cursor use `itemAt`; connect, drop and end drags keep `elementAt`.
- [x] 3. E2E in `containers.spec.ts`: a click on the line over a lane's fill selects the connector, empty lane space selects the lane, and a double click adds a bend.
- [x] 4. Docs: `connecting-objects.md` and `containers-swimlanes.md` say that clicks follow the drawing order.
