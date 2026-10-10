# Design

## Data

`packages/ui/src/tours/` holds the tour data and logic.

**Tour data**
- `tours.ts` defines `Tour { id, title, summary, page: 'start' | 'models' | 'model' | 'kits' | 'build' | 'any', needs?: 'model' | 'kit', steps: Step[] }`.
- `Step { anchor: string, title: string, text: string, placement?: 'right' | 'left' | 'top' | 'bottom', optional?: boolean }`.
- The texts are short, plain English, at most two sentences per step.

**Anchors**
- An anchor is the value of a `data-tour` attribute on the control, for example `data-tour="new-kit"`.
- Anchors are separate from test ids, so a test can be renamed without breaking a tour.

**Tour state**
- `tour-state.ts` is a small pure store: the current tour, the step index, `next`, `back` and `end`.
- Finished tours are kept in localStorage under `metakit.tours`, wrapped in try/catch.
- It is unit-tested in Node.

## Overlay

`components/tours/TourLayer.svelte` is mounted once in `App.svelte`.

**Finding and highlighting the control**
- It finds `[data-tour="<anchor>"]` and scrolls it into view.
- It draws a dimmed backdrop with a cut-out around the control. The cut-out is an SVG mask, so the control stays clickable.
- A focus ring outlines the control.

**Placing the pop-up**
- The pop-up (`role="dialog"`, labelled by its title) is placed beside the control.
- The step's `placement` is used if it fits, otherwise the side with the most room, and the pop-up is clamped to the viewport.
- The position is recomputed when the window is resized or scrolled.

**When a control is missing or changes**
- If the control is missing and the step is `optional`, the step is skipped.
- Otherwise the pop-up says "This part of the page is not shown right now" and offers Next.
- The layer watches the control's position with a ResizeObserver, so menus opening and lists changing don't leave the highlight behind.

**Keyboard and focus**
- Arrow keys and Enter move between steps; Escape ends the tour.
- Focus moves to the pop-up and returns to where it was when the tour ends.
- Help (F1) still works during a tour.

## Tutorials page

- **Opening it:** the top-bar Tutorials button (`data-testid="open-tutorials"`) opens an area like Documentation, with the same layering, so the canvas stays mounted. The start page gets a Tutorials link too.
- **Tour cards:** one card per tour, with the title, summary, "8 steps · about 1 minute", "Done" or "Not started", and **Start** or **Start again**.
- **Written tutorials:** the written tutorials are listed from the docs `tutorials` category.
- **Starting a tour:**
  - The page asks the App to switch to the tour's page.
  - If the tour needs a model or Kit and none is open, the card shows the message and a "Go to Models" or "Go to Kits" button instead.

## First-visit card

- After the forced profile dialog closes for the first time, a small card at the bottom right offers **Take the first-steps tour** or **Not now**.
- It is shown once, stored in localStorage.

## Tests

- **Unit:**
  - the tour state
  - every tour has steps
  - every step has text
  - every anchor used by a tour is unique within its tour
- **e2e (`tours.spec.ts`):** for each tour, prepare the matching state (start page, a seeded workspace, an open model, an open Kit), start it from the Tutorials page, press Next to the end, and assert that every step found its anchor. The layer exposes the "missing" state on `data-tour-missing`, so the test can check it.
- **Ending:** Escape ends a tour, and Start again starts it from the beginning.

## Delivery

| PR | Content |
| --- | --- |
| 1 | Engine, overlay, Tutorials page, first-visit card, first-steps tour, help topic |
| 2 | Models page, Modelling a model, Kits page and Help and settings tours |
| 3 | Building a Kit, Appearance and Rules and scripts tours |
