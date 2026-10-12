# Design

## Where the look lives

`<html>` carries two attributes:
- `data-theme`: the light/dark choice, as today.
- `data-look`: one of `workshop`, `drafting`, `meadow` or `classic`.

`theme.ts` grows a look next to the theme preference:
- `LookId`, `LOOK_KEY = 'metakit.look'`, `readLook()` and `applyLook()`.
- The page controller gets `look` and `setLook()`.
- The default is `workshop`, and an unknown stored value falls back to it.

Subscribers are told about both changes. `ModelView` and `ShapePreview` already re-read `canvasColors()` when the theme changes, so a look change repaints the canvas the same way.

`main.ts` already applies the theme before mounting, and applies the look the same way, so a reload shows no flash of the wrong look.

The current mode is written as `data-mode="model|build"` on `<html>` by `App.svelte`. This lets a look give each mode its own accent without any component knowing about looks.

## Tokens

These existing tokens keep their meaning:
- `--app-bg`, `--surface`, `--surface-2`, `--surface-3`, `--hover-bg`
- `--line`, `--line-strong`
- `--text`, `--text-strong`, `--text-muted`, `--text-faint`
- `--accent`, `--accent-hover`, `--accent-soft`, `--on-accent`
- status colours, canvas colours, radii, shadows, `--font`, `--font-mono`

New tokens:

| Token | Used by |
| --- | --- |
| `--font-display` | h1, h2, page titles, the brand, group and section headings |
| `--label-case`, `--label-tracking` | small uppercase labels (palette and Build group headings) |
| `--bar-bg`, `--bar-text`, `--bar-text-muted`, `--bar-line` | the top bar |
| `--mark`, `--mark-soft`, `--on-mark` | the active mode button, the active Build section indicator, `::selection`, `.badge.accent` |
| `--mode-model`, `--mode-build` | the Model and Build buttons when active; `--accent` follows the current mode where a look wants that |
| `--section-metamodel`, `--section-appearance`, `--section-behaviour`, `--section-kit` | the Build group headings and the indicator of the selected section |
| `--radius-pill` | primary buttons and the mode switch in Meadow; equal to `--radius` elsewhere |

For Classic, every new token has the value that reproduces today's look exactly, so Classic is a pixel-for-pixel regression check.

## Looks as data

`packages/ui/src/theme/looks.ts` exports `LOOKS`. For each look it holds:
- a name and a short description;
- its font families;
- `light` and `dark` token maps.

`pnpm looks:build` (`packages/ui/scripts/build-looks.ts`) writes `packages/ui/src/theme/looks.css`. For each look it writes:
- `:root[data-look='x']` with the light values;
- `:root[data-look='x'][data-theme='dark']` with the dark values;
- the same dark values under `@media (prefers-color-scheme: dark)` for `:root[data-look='x']:not([data-theme='light'])`.

This writes the dark values twice, as today, because `canvasColors()` cannot read `light-dark()`.

It also writes the mode rule: `:root[data-look='x'][data-mode='build'] { --accent: var(--mode-build) … }` for looks whose accent follows the mode, which is only Workshop.

`theme.css` keeps the base styles and imports `looks.css` and `fonts.css`.

**Tests** (`looks.test.ts`):
- the generated CSS equals the committed file;
- every look defines every token in both modes;
- contrast, by WCAG relative luminance:
  - `--text` on `--surface` and `--app-bg` ≥ 7:1
  - `--text-muted` on `--surface` ≥ 4.5:1
  - `--on-accent` on `--accent` ≥ 4.5:1
  - `--bar-text` on `--bar-bg` ≥ 4.5:1
  - `--on-mark` on `--mark` ≥ 4.5:1
  - `--accent` on `--surface` ≥ 3:1, for focus rings and links

## The four looks

The light values are the ones on the comparison page. Dark values are designed for each look:

| Look | Dark bg / surface | Bar | Accent / mark |
| --- | --- | --- | --- |
| Workshop | `#15151b` / `#1d1d25` | `#1d1d25`, accent underline | Model `#7aa2ff`, Build `#f07ac0`, sections amber `#e3a73e` and green `#4fc58f` |
| Drafting | `#0e1a1c` / `#152427` | `#0a1517` | accent `#41b8c4`, mark `#f5c518` |
| Meadow | `#121812` / `#1a221b` | `#1a221b`, green underline | forest `#55c28b`, violet `#ab8eff`, sun `#f5c04a` |
| Classic | today's dark values | today's | today's |

## Fonts

**Files:**
- Under `packages/ui/src/theme/fonts/<family>/`, one WOFF2 per weight range: Latin subset, variable where Fontsource offers one.
- Each family folder holds `OFL.txt`.
- `fonts.css` declares them with `font-display: swap`.

**Families:**
- IBM Plex Sans (variable)
- IBM Plex Sans Condensed (600, 700)
- IBM Plex Mono (400, 500)
- Familjen Grotesk (variable)
- Atkinson Hyperlegible (400, 700)
- Fira Code (variable)
- Bricolage Grotesque (variable)
- Hanken Grotesk (variable)

Browsers fetch a face only when text uses it, so only the active look's fonts download. Vite copies the files as hashed assets, and the service-free static site serves them.

The bundle-size check in CI measures JS and CSS. Fonts are reported on a separate line.

## Settings menu

Settings gets a "Look" group above the light/dark choices:
- four rows, each with three swatches, the name and a one-line description;
- the current one is marked, in the same style as the theme rows;
- test ids `look-<id>`.

Choosing a look applies it at once. It can be undone by choosing again, so there is no confirm.

## Components

Component edits are small and token-only:
- **TopBar:** uses `--bar-*`. The mode switch uses `--mode-*` for the active button.
- **BuildView:**
  - each group carries `data-section-group="<id>"`, so the heading and the indicator of the active tab read `--section-<id>`;
  - headings use `--font-display`;
  - the active tab gets an inset indicator in that colour.
- **Palette and ModelToolbar:** headings use the label tokens.
- **Base styles:**
  - h1 and h2 use `--font-display`;
  - `button.primary` uses `--radius-pill`;
  - `.segmented-control` reads `--mode-*` through `[data-mode-button]`.

## Risks

- **Font metrics** differ between looks, so text can wrap differently. The e2e suite runs on the default look (Workshop). One spec opens each page in every look at 1280 × 720 and checks that the top bar is one line and no control overflows its bar.
- **Screenshots in docs** show the default look and are retaken.
