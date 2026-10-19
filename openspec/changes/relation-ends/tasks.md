# Tasks

## 1. One description (`packages/core`)

- [x] 1.1 `meta/ends.ts`: `concreteEndClasses`, `relationEndClasses`, `describeRelationEnds`, `includedSubclasses`, `withArticle`, `orList`, `connectsPhrase`, `connectsSentence`.
- [x] 1.2 Unit tests: abstract expansion, a class with subclasses named once, inherited ends, model-type filter, labels by language, a/an, lists.

## 2. Use it everywhere

- [x] 2.1 Palette card: the sentence, and From and To lists for long ones; the palette passes the model type.
- [x] 2.2 `describeEnds` and the hint line; the palette-class hint uses `allowsEnd` at both ends and the model type.
- [x] 2.3 Class catalog dialog: one sentence per relation class, "any class" for open ends.
- [x] 2.4 Refusal message: labels, "a" or "an", and what the relation connects.

## 3. Build mode

- [x] 3.1 Relation editor: "Can connect" summary, what each class brings in, labels beside keys.

## 4. Model mode

- [x] 4.1 Active layer: an `ends` set drawn like `suggest`, culled to the screen.
- [x] 4.2 Editor: outline possible starts while the connect tool is on and possible ends once a start is picked; `onLinkChange` tells the host.
- [x] 4.3 Model view: the hint moves to "Let go on an outlined concept…" while a start is picked.

## 5. Tests and docs

- [x] 5.1 Update the unit tests that quote the old wording (palette preview, suggestions and hints, canvas helpers).
- [x] 5.2 E2E: palette card text (`model-view-ux.spec.ts`), hint text (`smart-modelling.spec.ts`), outlined starts and ends through the canvas harness (`canvas.spec.ts`).
- [x] 5.3 Docs: palette preview, palette, interaction hints, connecting objects, status and messages, relation classes, abstract classes, class catalog.
