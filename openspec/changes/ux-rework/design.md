# Design

## Information architecture

- **Start** (no workspace): what MetaKit is in one sentence, three steps (open or create a workspace folder, add or build a tool library, model), the remembered folder first, browser support notice.
- **Workspace** has a top bar: brand, workspace name, a switch **Model | Build**, search, settings menu (Appearance, Git, Assistant, Close workspace).
  - **Model** area: page "Models" (cards by folder, New model, import and export in an Import / Export menu), and the model view.
  - **Build** area: page "Tool libraries" (cards, New tool library, Add from file, Open from Git, export), and the tool library editor.
- The model view and the tool library editor keep their own bars but share the same visual language and a clear "back to Models / Tool libraries".

## Model view

Toolbar menus: File (Export, Import), Edit (Undo, Redo, Find), View (Fit, Zoom, View selector, Minimap), Arrange (Arrange, Auto-layout), Check (Problems, Check commands from rules and scripts), Commands (rule and script commands). Palette entries show a preview card on hover or keyboard focus: the shape drawn at small size, the label, the help text, the attributes (key and type), and for a relation class the allowed start and end classes.

## Build view

Navigation groups: Metamodel (Classes, Relation classes, Model types), Appearance (Shapes, Panel layouts), Behaviour (Rules, Scripts), Tool library (Settings). A Source control menu (Git: link, commit, pull, releases) shows only for linked tool libraries.

## Style

Tokens in CSS custom properties on `:root` with `[data-theme='dark']` and `prefers-color-scheme` overrides; legacy names (`--bg`, `--panel`, `--line`, `--muted`, `--accent`, `--danger`, `--hover`) keep working. Base element styles come from one global stylesheet; components keep scoped layout only. Targets: contrast of 4.5:1 for text in both themes, visible focus, sizes that work from 1024 px wide.
