import { run } from '@metakit-app/formula';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildColourFormula,
  parseColourFormula,
  type ColourMapping,
} from './colour-map';

const PRIORITY: ColourMapping[] = [
  { value: 'High', colour: '#D93025' },
  { value: 'Medium', colour: '#F29900' },
];

describe('colour by attribute formula', () => {
  it('writes the style of the plan', () => {
    expect(buildColourFormula('Priority', PRIORITY, '#5F6368')).toBe(
      "= Priority == 'High' ? '#D93025' : Priority == 'Medium' ? '#F29900' : '#5F6368'",
    );
  });

  it('writes numbers and booleans without quotes', () => {
    expect(
      buildColourFormula(
        'Done',
        [
          { value: true, colour: '#0f0' },
          { value: -2, colour: '#f00' },
        ],
        '#999',
      ),
    ).toBe("= Done == true ? '#0f0' : Done == -2 ? '#f00' : '#999'");
  });

  it('gives just the fallback when nothing is mapped', () => {
    expect(buildColourFormula('X', [], '#111')).toBe("= '#111'");
    expect(parseColourFormula("= '#111'")).toBeNull();
  });

  it('is evaluated by the formula engine to the mapped colour', () => {
    const f = buildColourFormula('Priority', PRIORITY, '#5F6368');
    const at = (p: string) =>
      run(f.slice(1), { get: (n) => (n === 'Priority' ? p : undefined) });
    expect(at('Medium').value).toBe('#F29900');
    expect(at('Low').value).toBe('#5F6368');
  });

  it('reads the plan formula back', () => {
    expect(
      parseColourFormula(
        "= Priority == 'High' ? '#D93025' : Priority == 'Medium' ? '#F29900' : '#5F6368'",
      ),
    ).toEqual({
      attribute: 'Priority',
      mapping: PRIORITY,
      fallback: '#5F6368',
    });
  });

  it('escapes quotes and backslashes', () => {
    const f = buildColourFormula(
      'K',
      [{ value: "it's \\ a\nb", colour: '#fff' }],
      '#000',
    );
    expect(parseColourFormula(f)?.mapping[0]!.value).toBe("it's \\ a\nb");
  });

  it.each([
    '= Priority',
    '= 1 + 2',
    "= A == 'x' ? '#111' : B == 'y' ? '#222' : '#333'",
    "= A == 'x' ? Other : '#333'",
    "= A == 'x' ? '#111' : '#222' + 'x'",
    "= A != 'x' ? '#111' : '#222'",
    "= A == 'x' ? '#111'",
    '= A ==',
    "= 'unclosed",
    'not a formula',
  ])('returns null for %s', (src) => {
    expect(parseColourFormula(src)).toBeNull();
  });

  it('round-trips any mapping', () => {
    const value = fc.oneof(
      fc.string({ maxLength: 12 }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.boolean(),
    );
    const colour = fc.string({ maxLength: 10 });
    const key = fc.stringMatching(/^[A-Za-z_][A-Za-z0-9_]{0,10}$/);
    fc.assert(
      fc.property(
        key,
        fc.array(fc.record({ value, colour }), { minLength: 1, maxLength: 6 }),
        colour,
        (attribute, mapping, fallback) => {
          const parsed = parseColourFormula(
            buildColourFormula(attribute, mapping, fallback),
          );
          expect(parsed).toEqual({ attribute, mapping, fallback });
        },
      ),
    );
  });
});
