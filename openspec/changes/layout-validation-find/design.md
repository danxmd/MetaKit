# Design

- **Worker.** ELK runs in a module worker; a `LayoutService` posts the graph and gets positions back, with a timeout and cancellation; an in-process engine serves Node tests.
- **Command.** `applyLayout { moves, resizes?, bends? }` changes many things in one step and fits swimlanes afterwards.
- **Containers** are nested ELK nodes.
- **Validation list.** A pure view model groups issues by severity and describes their targets; the panel is keyboard navigable and selects the object on click.
- **Find.** `findAcrossModels` scans labels, text values, class names and attribute keys and values, limited to 200 hits.
