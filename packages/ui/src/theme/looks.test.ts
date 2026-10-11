import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { looksCss } from './looks-css';
import {
  BASE_TOKENS,
  COLOUR_TOKENS,
  LOOK_IDS,
  LOOKS,
  lookValue,
  type ColourToken,
  type Look,
} from './looks';

/** WCAG relative luminance of a #rgb or #rrggbb colour. */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const h =
    m[1]!.length === 3
      ? [...m[1]!].map((c) => c + c).join('')
      : (m[1] as string);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast', () => {
  it('matches the WCAG examples', () => {
    expect(contrast('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('looks', () => {
  it('looks.css is what `pnpm looks:build` writes', () => {
    const committed = readFileSync(
      new URL('./looks.css', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n');
    expect(committed).toBe(looksCss());
  });

  it('every look defines every token in light and dark', () => {
    for (const id of LOOK_IDS) {
      const look = LOOKS[id];
      expect(look.id).toBe(id);
      for (const t of BASE_TOKENS)
        expect(lookValue(look, 'light', t), `${id} ${t}`).not.toBe('');
      for (const scheme of ['light', 'dark'] as const)
        for (const t of COLOUR_TOKENS)
          expect(lookValue(look, scheme, t), `${id} ${scheme} ${t}`).not.toBe(
            '',
          );
    }
  });

  it('only Workshop changes its accent with the mode', () => {
    expect(LOOK_IDS.filter((id) => LOOKS[id].build)).toEqual(['workshop']);
  });

  // Each check: foreground, background, the least contrast.
  const CHECKS: [ColourToken, ColourToken, number][] = [
    ['--text', '--surface', 7],
    ['--text', '--app-bg', 7],
    ['--text-muted', '--surface', 4.5],
    ['--on-accent', '--accent', 4.5],
    ['--bar-text', '--bar-bg', 4.5],
    ['--bar-text-strong', '--bar-bg', 4.5],
    ['--bar-text-muted', '--bar-bg', 4.5],
    ['--on-mark', '--mark', 4.5],
    ['--on-mode', '--mode-model', 4.5],
    ['--on-mode', '--mode-build', 4.5],
    ['--mark-text', '--mark-soft', 3],
    ['--tab-active-text', '--tab-active-bg', 3],
    ['--on-brand', '--brand', 3],
    // Focus rings and links.
    ['--accent', '--surface', 3],
    ['--accent', '--app-bg', 3],
    // The small headings over groups.
    ['--label-text', '--surface', 3],
    ['--section-metamodel', '--surface', 3],
    ['--section-appearance', '--surface', 3],
    ['--section-behaviour', '--surface', 3],
    ['--section-kit', '--surface', 3],
  ];

  const cases = LOOK_IDS.flatMap((id) =>
    (['light', 'dark'] as const).flatMap((scheme) =>
      (LOOKS[id].build
        ? (['model', 'build'] as const)
        : (['model'] as const)
      ).map((mode) => [LOOKS[id], scheme, mode] as const),
    ),
  );

  it.each(cases.map(([look, scheme, mode]) => [look.id, scheme, mode, look]))(
    '%s in %s (%s mode) is readable',
    (_id, scheme, mode, look) => {
      const value = (t: ColourToken) =>
        lookValue(look as Look, scheme as 'light' | 'dark', t, mode as 'model');
      const failures = CHECKS.filter(
        ([fg, bg, least]) => contrast(value(fg), value(bg)) < least,
      ).map(
        ([fg, bg, least]) =>
          `${fg} on ${bg}: ${contrast(value(fg), value(bg)).toFixed(2)} < ${least}`,
      );
      expect(failures).toEqual([]);
    },
  );

  it('the new looks keep small headings, badges and the open section at AA', () => {
    // Classic stays as it always was (faint headings, 4.3:1 on its accent-soft); the other looks
    // colour these and keep them at the contrast of body text.
    const pairs: [ColourToken, ColourToken][] = [
      ['--label-text', '--surface'],
      ['--section-metamodel', '--surface'],
      ['--section-appearance', '--surface'],
      ['--section-behaviour', '--surface'],
      ['--section-kit', '--surface'],
      ['--mark-text', '--mark-soft'],
      ['--tab-active-text', '--tab-active-bg'],
    ];
    for (const [look, scheme, mode] of cases.filter(
      ([l]) => l.id !== 'classic',
    ))
      for (const [fg, bg] of pairs)
        expect(
          contrast(
            lookValue(look, scheme, fg, mode),
            lookValue(look, scheme, bg, mode),
          ),
          `${look.id} ${scheme} ${mode} ${fg} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
  });
});
