import {
  BASE_TOKENS,
  COLOUR_TOKENS,
  DEFAULT_LOOK,
  LOOK_IDS,
  LOOKS,
  type Look,
} from './looks';

const block = (selectors: string[], lines: string[], indent = ''): string[] => [
  selectors.map((s) => indent + s).join(',\n') + ' {',
  ...lines.map((l) => `${indent}  ${l}`),
  `${indent}}`,
];

const declarations = (
  tokens: readonly string[],
  values: Partial<Record<string, string>>,
): string[] =>
  tokens
    .filter((t) => values[t] !== undefined)
    .map((t) => `${t}: ${values[t]};`);

function lookCss(look: Look): string[] {
  const roots = [`:root[data-look='${look.id}']`];
  // Before a look is written to the page (or if it never is), the default look applies.
  if (look.id === DEFAULT_LOOK) roots.unshift(':root:not([data-look])');
  const light = [
    'color-scheme: light;',
    ...declarations(BASE_TOKENS, look.base),
    ...declarations(COLOUR_TOKENS, look.light),
  ];
  const dark = [
    'color-scheme: dark;',
    ...declarations(COLOUR_TOKENS, look.dark),
  ];
  const out = [
    `/* ${look.name}: ${look.description} */`,
    ...block(roots, light),
    ...block(
      roots.map((r) => `${r}[data-theme='dark']`),
      dark,
    ),
    '@media (prefers-color-scheme: dark) {',
    ...block(
      roots.map((r) => `${r}:not([data-theme='light'])`),
      dark,
      '  ',
    ),
    '}',
  ];
  if (look.build) {
    const build = `:root[data-look='${look.id}'][data-mode='build']`;
    out.push(
      `/* ${look.name}: the accent follows the mode. */`,
      ...block([build], declarations(COLOUR_TOKENS, look.build.light)),
      ...block(
        [`${build}[data-theme='dark']`],
        declarations(COLOUR_TOKENS, look.build.dark),
      ),
      '@media (prefers-color-scheme: dark) {',
      ...block(
        [`${build}:not([data-theme='light'])`],
        declarations(COLOUR_TOKENS, look.build.dark),
        '  ',
      ),
      '}',
    );
  }
  return out;
}

/**
 * The CSS of every look. The dark values are written twice, for a chosen Dark theme and for a
 * system that prefers dark: `canvasColors()` reads the tokens back with getComputedStyle, and a
 * `light-dark()` value would come back as the function, not a colour the canvas can paint with.
 */
export function looksCss(): string {
  const parts = [
    '/* Written by `pnpm looks:build` from looks.ts. Do not edit by hand. */',
  ];
  for (const id of LOOK_IDS) parts.push('', ...lookCss(LOOKS[id]));
  return parts.join('\n') + '\n';
}
