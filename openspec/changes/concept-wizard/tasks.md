# Tasks

- [x] 1.1 `build/concept-wizard.ts`: the draft, steps, step checks, PascalCase keys, the one batch (`putShape`, `putClass`/`putRelation`, `putModelType`), a whole-Kit check on a copy, and the summary. Unit tests: keys, each step's checks, inherited attributes, a valid class and relation in one undo step, abstract classes left out of model types, switching kind.
- [x] 1.2 `components/build/ConceptWizard.svelte`: the dialog with the step list, Back, Next, the problems and the docs context `dialog.concept-wizard`.
- [x] 1.3 Build mode: **Step by step…** under the New box of classes and relation classes; the new item is selected.
- [x] 1.4 Model view: **+ New class or relation…** under the palette; `Controller.runKit`/`undoKit`; pick the new item; switch the palette view to All when needed; Undo in the toast, refused once the model uses it.
- [x] 1.5 ADR 0014.
- [x] 1.6 Docs: `build/concept-wizard.md`; mention it in `build/classes.md`, `build/relations.md` and `model/palette.md`.
- [x] 1.7 E2E: add a class from the model view and place it; add a relation and connect two objects; Undo; Step by step in Build mode; a step that is not complete stays.
