import { PART_TYPES, isFormula } from '@metakit-app/core';
import { describe, expect, it } from 'vitest';
import { propertiesFor } from './part-properties';

describe('propertiesFor', () => {
  it.each(PART_TYPES)('lists unique properties for %s', (type) => {
    const props = propertiesFor(type).map((p) => p.prop);
    expect(props.length).toBeGreaterThan(3);
    expect(new Set(props).size).toBe(props.length);
    expect(props.slice(0, 4)).toEqual(['x', 'y', 'width', 'height']);
  });

  it('offers the colour helper for fills, strokes and text colour', () => {
    const helped = (t: Parameters<typeof propertiesFor>[0]) =>
      propertiesFor(t)
        .filter((p) => p.helper)
        .map((p) => p.prop);
    expect(helped('rect')).toEqual(['fill', 'stroke']);
    expect(helped('text')).toEqual(['font.color']);
    expect(helped('image')).toEqual([]);
  });

  it('has a fixed fallback for every property except the click formula', () => {
    for (const t of PART_TYPES)
      for (const p of propertiesFor(t))
        expect(isFormula(p.fallback)).toBe(p.kind === 'formula');
  });

  it('gives choices to every choice property', () => {
    for (const t of PART_TYPES)
      for (const p of propertiesFor(t))
        if (p.kind === 'choice')
          expect(p.choices?.map((c) => c.value)).toContain(p.fallback);
  });

  it('does not offer fx on properties that cannot hold a formula', () => {
    const text = Object.fromEntries(
      propertiesFor('text').map((p) => [p.prop, p.fx]),
    );
    expect(text).toMatchObject({
      align: false,
      valign: false,
      wrap: false,
      fit: false,
      text: true,
      'font.size': true,
    });
  });
});
