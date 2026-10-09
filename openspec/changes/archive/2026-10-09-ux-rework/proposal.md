# Proposal

## Why

Danial's review of the first complete version: the buttons and boxes are placed at random and make little sense, the landing page makes no sense, functions are not sorted into categories, modelling and metamodelling (making tools) are not clearly separated, concepts and relations need a preview on hover, and the tool needs a dark mode and a general style rework. The canvas itself works well and stays as it is.

## What Changes

- A design system in `packages/ui`: tokens for light and dark, base styles for buttons, fields, cards, menus, tabs and dialogs, and a theme switch (system, light, dark) that is remembered per browser.
- A new app shell with two clearly separate areas: **Model** (work with models) and **Build** (make tool libraries), a settings menu (appearance, Git, assistant) and a workspace bar.
- A new landing page that says what MetaKit is, what a workspace is, and offers the next step; a workspace home with separate pages for models and tool libraries, with actions grouped into New, Import and Export, and Open from.
- Model view: toolbar commands grouped in labelled menus (File, Edit, View, Arrange, Check, Commands), a palette with a preview of each class and relation on hover (shape, description, attributes, allowed ends).
- Build view: navigation grouped into Metamodel, Appearance and Behaviour; source control (Git) in its own menu; the same styles throughout.
- The canvas, minimap and exports follow the theme.

## Capabilities

### New Capabilities

- `ux-rework`

## Impact

- No file format or command changes. Existing test ids stay; navigation tests are updated where the path to a function changed.
