import { describe, expect, it } from 'vitest';
import type { AttributeDef } from './types';
import {
  checkAttributeValue,
  isEmptyValue,
  isIsoDate,
  isIsoDateTime,
  isIsoDuration,
} from './values';

const def = (extra: Record<string, unknown>): AttributeDef =>
  ({ id: 'att_x', key: 'X', ...extra }) as unknown as AttributeDef;
const codes = (d: AttributeDef, v: unknown) =>
  checkAttributeValue(d, v).map((p) => p.code);

describe('empty values', () => {
  it('treats zero and false as values', () => {
    for (const v of [undefined, null, '', []])
      expect(isEmptyValue(v)).toBe(true);
    for (const v of [0, false, 'a', [0], {}])
      expect(isEmptyValue(v)).toBe(false);
  });
});

describe('text', () => {
  const text = def({ type: 'text', maxLength: 10, pattern: '^[A-Z]{3}-\\d+$' });
  it('checks length and pattern', () => {
    expect(codes(text, 'ABC-1')).toEqual([]);
    expect(codes(text, 'ABC-12345678')).toEqual(['max-length']);
    expect(codes(text, 'abc')).toEqual(['pattern']);
    expect(codes(text, 5)).toEqual(['wrong-type']);
    expect(codes(text, '')).toEqual([]);
  });
  it('words the problem for a person', () => {
    expect(checkAttributeValue(text, 'ABC-12345678')[0]!.message).toBe(
      'is longer than 10 characters (it has 12)',
    );
  });
});

describe('numbers', () => {
  it('integer', () => {
    const d = def({ type: 'integer', min: 1, max: 5 });
    expect(codes(d, 3)).toEqual([]);
    expect(codes(d, 2.5)).toEqual(['not-integer']);
    expect(codes(d, 0)).toEqual(['min']);
    expect(codes(d, 6)).toEqual(['max']);
    expect(codes(d, '3')).toEqual(['wrong-type']);
    expect(codes(d, Number.NaN)).toEqual(['wrong-type']);
  });
  it('number with decimals', () => {
    const d = def({ type: 'number', min: 0, decimals: 1 });
    expect(codes(d, 1.5)).toEqual([]);
    expect(codes(d, 1.25)).toEqual(['decimals']);
    expect(codes(d, -1)).toEqual(['min']);
    expect(codes(d, 0)).toEqual([]);
  });
});

describe('boolean, dates and durations', () => {
  it('boolean', () => {
    const d = def({ type: 'boolean' });
    expect(codes(d, true)).toEqual([]);
    expect(codes(d, false)).toEqual([]);
    expect(codes(d, 'yes')).toEqual(['wrong-type']);
    expect(codes(d, undefined)).toEqual([]);
  });
  it('dates are real calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-2-3')).toBe(false);
    expect(codes(def({ type: 'date' }), '31 Feb 2026')).toEqual(['bad-date']);
  });
  it('date and time', () => {
    for (const ok of [
      '2026-10-07T09:30:00Z',
      '2026-10-07T09:30',
      '2026-10-07T09:30:15.250+02:00',
    ])
      expect(isIsoDateTime(ok)).toBe(true);
    for (const bad of [
      '2026-10-07',
      '2026-10-07T25:00:00Z',
      '2026-02-30T10:00:00Z',
    ])
      expect(isIsoDateTime(bad)).toBe(false);
  });
  it('duration', () => {
    for (const ok of ['PT90M', 'P1DT2H', 'P2W', 'PT0.5S'])
      expect(isIsoDuration(ok)).toBe(true);
    for (const bad of ['P', 'PT', '90 minutes', 'P1H', 'PT1D'])
      expect(isIsoDuration(bad)).toBe(false);
  });
});

describe('choices', () => {
  const choice = def({
    type: 'choice',
    options: ['Low', { value: 'High', labels: { en: 'High' } }],
  });
  it('checks membership', () => {
    expect(codes(choice, 'Low')).toEqual([]);
    expect(codes(choice, 'High')).toEqual([]);
    expect(codes(choice, 'Mid')).toEqual(['not-an-option']);
    expect(checkAttributeValue(choice, 'Mid')[0]!.message).toContain(
      'Low, High',
    );
  });
  it('multi-choice counts', () => {
    const d = def({
      type: 'multi-choice',
      options: ['a', 'b', 'c'],
      min: 1,
      max: 2,
    });
    expect(codes(d, ['a', 'b'])).toEqual([]);
    expect(codes(d, ['a', 'b', 'c'])).toEqual(['max-count']);
    expect(codes(d, ['z'])).toEqual(['not-an-option']);
    expect(codes(d, ['a', 'a'])).toEqual(['duplicate']);
    expect(codes(d, 'a')).toEqual(['wrong-type']);
  });
});

describe('tables, references, links', () => {
  const table = def({
    type: 'table',
    maxRows: 2,
    columns: [
      { id: 'c1', key: 'Qty', type: 'integer' },
      { id: 'c2', key: 'Note', type: 'text' },
    ],
  });
  it('checks rows and cells', () => {
    expect(codes(table, [{ c1: 1, c2: 'x' }])).toEqual([]);
    expect(codes(table, [{}, {}, {}])).toEqual(['max-count']);
    expect(codes(table, [{ c1: 'one' }])).toEqual(['cell-wrong-type']);
    expect(codes(table, [{ c1: 1, zzz: 1 }])).toEqual(['unknown-column']);
    expect(codes(table, [5])).toEqual(['wrong-type']);
  });
  it('references', () => {
    const d = def({ type: 'reference', target: {}, max: 1 });
    expect(codes(d, [{ element: 'el_a' }])).toEqual([]);
    expect(codes(d, [{ element: 'el_a' }, { element: 'el_b' }])).toEqual([
      'max-count',
    ]);
    expect(codes(d, ['el_a'])).toEqual(['wrong-type']);
  });
  it('links', () => {
    const any = def({ type: 'link' });
    expect(codes(any, 'https://example.com/x')).toEqual([]);
    expect(codes(any, 'assets/plan.pdf')).toEqual([]);
    expect(codes(any, '../secret')).toEqual(['bad-link']);
    expect(codes(any, 'file:///etc/passwd')).toEqual(['bad-link']);
    expect(
      codes(def({ type: 'link', target: 'url' }), 'assets/plan.pdf'),
    ).toEqual(['bad-link']);
    expect(
      codes(def({ type: 'link', target: 'file' }), 'https://example.com'),
    ).toEqual(['bad-link']);
  });
  it('formula and action values are not checked', () => {
    expect(codes(def({ type: 'formula', formula: '1' }), 'anything')).toEqual(
      [],
    );
    expect(
      codes(def({ type: 'action', run: { kind: 'rule', ref: 'r' } }), 5),
    ).toEqual([]);
  });
});
