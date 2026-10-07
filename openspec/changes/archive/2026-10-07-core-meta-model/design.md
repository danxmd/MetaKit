# Design

## Context

Plan sections "Meta-model and file formats" and the attribute-type table fix the concepts (see `docs/implementation-plan.md`). `docs/phase-1.md` 1.1 lists the deliverables.

## Decisions

**D1. Plain data, no classes.** A tool library is JSON-shaped data: records keyed by ID for classes, relation classes and model types (so phase 3 can merge per entry), arrays only where order matters (a class's attributes, choice options, table columns). Nothing needs a constructor or prototype, so JSON round-trips exactly.

**D2. Hand-written guards, no schema library.** Guards return a list of issues, each with a path such as `classes.cls_task.attributes[2].options` and a message a method engineer can act on. No dependency is added; the guard code doubles as documentation of the format.

**D3. IDs.** `<prefix>_<10 characters of base 32>`, from the platform's random source (`globalThis.crypto`). 50 bits make a clash among tens of thousands of elements negligible; the store also retries on a clash. Prefixes: `tool_ cls_ rel_ att_ mt_ shp_ el_ cn_` from `CLAUDE.md`, plus `mdl_` and `vw_`. Parsing and printing IDs is in one place.

**D4. Keys are unique where formulas look them up.** Class keys and relation keys are unique across a tool library; model type keys likewise; attribute keys are unique within a class's effective attributes (own and inherited), within a relation's, and within a model type's model attributes. A subclass cannot redefine an inherited key.

**D5. Inheritance.** A class has at most one parent (`extends`). Cycles are an error. Effective attributes are the ancestors' (root first) followed by the class's own. `isA(a, b)` is true when `a` is `b` or descends from it. A relation class inherits the same way; its effective FROM and TO lists are its own if non-empty, otherwise the parent's, and a relation without a parent must list at least one class on each side. A FROM or TO entry matches an element when the element's class `isA` the entry, so an abstract class means "any subclass".

**D6. Defaults are checked against the type.** A default of the wrong type is a definition error, found when the library is loaded, not when an element is created.

## Risks / Trade-offs

- [Hand-written guards can drift from the types] → a test builds a valid library covering every attribute type and every guard branch has a negative test.
- [Records keyed by ID lose order] → order is not meaningful for classes and model types; listings sort by key.
