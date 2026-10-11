# Tasks

One PR (`feat/looks`), stacked on the open UI and bug-fix PRs.

## 1. Looks and tokens

- [ ] 1.1 `looks.ts` with the four looks (light and dark tokens, fonts, name, description); Classic equals today's values.
- [ ] 1.2 `build-looks.ts` and `pnpm looks:build` writing `looks.css`; `theme.css` keeps base styles and imports it.
- [ ] 1.3 `looks.test.ts`: generated CSS matches, every token defined, contrast checks.

## 2. Fonts

- [ ] 2.1 WOFF2 files and OFL licences under `theme/fonts/`, plus `fonts.css`.
- [ ] 2.2 CI bundle report lists fonts separately.

## 3. Applying the look

- [ ] 3.1 `theme.ts`: look id, storage, `setLook`, subscribers; `main.ts` applies it before mounting.
- [ ] 3.2 `data-mode` on `<html>` from `App.svelte`.
- [ ] 3.3 Components read the new tokens: TopBar, mode switch, BuildView groups, palette headings, base headings and primary buttons.
- [ ] 3.4 Settings ▸ Look with `look-<id>` rows.

## 4. Tests and docs

- [ ] 4.1 Unit tests for the look controller; e2e: choose each look, reload keeps it, canvas colours follow, the top bar fits at 1280 × 720 in every look.
- [ ] 4.2 Docs: `theme` → "Look and theme", `settings-menu`, quick tour, the "Help and settings" tour step.
- [ ] 4.3 README screenshots in the default look.
- [ ] 4.4 typecheck, lint, test, test:e2e, bench.
