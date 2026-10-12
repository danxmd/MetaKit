# Proposal

## Why

Every surface in MetaKit has the same grey-blue neutrals, one indigo accent and a system font. That looks generic and flat, and nothing tells Model mode from Build mode or one Build section from another. Danial compared three directions on the real app (artifact "Three looks for MetaKit", 2026-10-11) and chose to keep all three and let each person pick one.

## What Changes

- **Four looks**, each in light and dark, chosen under **Settings ▸ Look**:

  | Look | Neutrals | Accent and highlights | Fonts |
  | --- | --- | --- | --- |
  | **Workshop** (default) | white boards on a cool grey | Model mode blue, Build mode magenta, one colour per Build section | Familjen Grotesk, Atkinson Hyperlegible, Fira Code |
  | **Drafting** | cool paper, slate-teal top bar | teal, with highlighter yellow for what is active | IBM Plex Sans, Plex Sans Condensed, Plex Mono |
  | **Meadow** | sage-tinted | forest green and violet, sunflower for what is open; rounder buttons | Bricolage Grotesque, Hanken Grotesk, Fira Code |
  | **Classic** | today's look, unchanged | indigo | system font |

- **The look works with Light, Dark and System**, which stay as they are. The choice belongs to the person: it is stored in the browser (`metakit.look`), like `metakit.theme`, and never in the workspace folder.
- **New design tokens** that the looks set and the components read:
  - a display font for titles and labels
  - top-bar colours
  - a "mark" colour for what is active
  - a colour for each mode
  - a colour for each Build section group
  - a pill radius

  The top bar, the Model | Build switch, section headings, the Build sidebar and the palette headings use them. No component keeps a look-specific rule.
- **Fonts ship with the app** as WOFF2 files (Latin subset, variable where the family has one), with their SIL Open Font Licence files. A browser downloads only the fonts of the look in use, so Classic downloads none and the others download about 100–150 KB once. The app still makes no outside requests.
- **Looks are defined in TypeScript** and `theme.css` is generated from them. A unit test checks text, muted text, accent and button contrast for every look in light and dark (WCAG AA), and that the generated CSS matches the definitions.
- **Documentation:** the `theme` topic becomes "Look and theme", and `settings-menu`, the "Help and settings" tour, the README screenshots and the quick tour are updated.

## Capabilities

### New Capabilities

- `looks`

## Impact

- **Changed:** `packages/ui` (theme, top bar, Build view, palette, settings menu), `apps/web/src/main.ts`, `packages/docs/content`, and e2e tests for the settings menu and the tours. New font files go under `packages/ui/src/theme/fonts/`.
- **No change** to file formats, commands, storage in the workspace, or the canvas drawing. The canvas reads its background, grid and selection colours from the tokens, as it does today.
- **No new runtime dependency.** The font files are copied in once from the Fontsource npm packages; nothing is added to `package.json` at runtime.
- **Size:** the app's JavaScript and CSS grow by a few kilobytes. Font files are separate assets loaded on demand.
- **Test ids:** `look-workshop`, `look-drafting`, `look-meadow` and `look-classic` are added; existing ids stay.
