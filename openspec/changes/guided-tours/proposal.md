# Proposal

## Why

New users don't know what the buttons on each page do, and reading help topics first is slow. Short guided tours that point at the real buttons, one step at a time, teach each page in a minute or two, and people can start them whenever they like.

## What Changes

**Guided tours**
- A step-by-step overlay highlights one button or area at a time.
- A small pop-up next to it says what it does, with **Back**, **Next**, a step count ("3 of 8") and **End tour**.
- Escape ends the tour, and the arrow keys move between steps.
- The rest of the page is dimmed but stays visible, and the highlighted control can be used while the tour runs.

**A Tutorials tab**
- A new **Tutorials** entry in the top bar opens the Tutorials page. It is also on the start page, before a workspace is open.
- The page lists every guided tour with its length, whether it is done, and a **Start** button.
- Below the tours it lists the written tutorials, the step-by-step help topics.

**Tours that start where they make sense**
- Each tour belongs to a page.
- Starting a tour goes to its page, where possible.
- A tour that needs an open model or Kit says so, and offers to go to the Models or Kits page instead of starting half-way.

**Eight tours at the start**

| Tour | Covers |
| --- | --- |
| First steps | Opening or creating a workspace folder, Help, the three steps |
| Models page | New model, folders, search across models, import and export, deleted models |
| Modelling a model | Palette, placing and connecting, the attribute panel, the menus, find, undo, problems, people and the save status |
| Kits page | Your Kits and the built-in ones, Use in this workspace, Copy and extend, New Kit, Add from file or Git |
| Building a Kit | Sections, classes, Add from catalog, the class editor, attributes, Try it, undo, Source control |
| Appearance | Base form, colours, colour by attribute, badges, the drawing editor |
| Rules and scripts | When, If and Then; commands; scripts and permissions |
| Help and settings | The Help side bar (F1), Documentation, appearance (theme), your name and colour, Git and the assistant |

**First visit**
- After "Who are you?", a small card offers **Take the first-steps tour** or **Not now**.
- It is shown once per browser.

**Documentation**
- A new help topic, `guided-tours`.
- The topics for the top bar and the start page are updated.

## Capabilities

### New Capabilities

- `guided-tours`

## Impact

- **No format changes; nothing is written to the workspace.** Finished tours are remembered in the browser only.
- **No new dependency:** the overlay and the positioning are a small Svelte component.
- **Size:** the tour texts load only when the Tutorials page or a tour opens.
- **Stable anchors:** key controls get a `data-tour` anchor. An e2e test walks every tour through every step and fails when an anchor is missing, so tours can't silently break when the UI changes.
- **Order:** this starts after the Kit rename's PR 2, so anchors are added to the renamed components.
- **Delivery:** about three PRs:
  1. tour engine, Tutorials page and the first-steps tour
  2. the page tours
  3. the Build tours
