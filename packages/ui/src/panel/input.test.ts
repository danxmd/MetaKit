import { describe, expect, it } from 'vitest';
import type { AttributeDef } from '@metakit-app/core';
import { editCommands, parseInput } from './input';

const def = (rest: Record<string, unknown>): AttributeDef =>
  ({ id: 'att_x', key: 'X', ...rest }) as unknown as AttributeDef;

describe('parseInput', () => {
  it('parses numbers and treats empty as unset', () => {
    const n = def({ type: 'number', min: 0, max: 10, decimals: 1 });
    expect(parseInput(n, '2.5')).toEqual({ ok: true, value: 2.5 });
    expect(parseInput(n, ' 1,5 ')).toEqual({ ok: true, value: 1.5 });
    expect(parseInput(n, '')).toEqual({ ok: true, value: null });
    expect(parseInput(n, '  ')).toEqual({ ok: true, value: null });
  });

  it('explains bad numbers', () => {
    const n = def({ type: 'number', min: 0, max: 10, decimals: 1 });
    expect(parseInput(n, 'abc')).toEqual({
      ok: false,
      message: '"abc" is not a number.',
    });
    expect(parseInput(n, '-1')).toEqual({
      ok: false,
      message: 'This must be at least 0.',
    });
    expect(parseInput(n, '11')).toMatchObject({ ok: false });
    expect(parseInput(n, '1.25')).toMatchObject({
      ok: false,
      message: 'This must have at most 1 decimal places.',
    });
  });

  it('parses integers', () => {
    const i = def({ type: 'integer' });
    expect(parseInput(i, '42')).toEqual({ ok: true, value: 42 });
    expect(parseInput(i, '4.5')).toEqual({
      ok: false,
      message: 'This must be a whole number.',
    });
    expect(parseInput(i, '1e')).toMatchObject({ ok: false });
  });

  it('parses text with limits', () => {
    const t = def({ type: 'text', maxLength: 3, pattern: '^[a-z]+$' });
    expect(parseInput(t, 'abc')).toEqual({ ok: true, value: 'abc' });
    expect(parseInput(t, '')).toEqual({ ok: true, value: null });
    const bad = parseInput(t, 'ABCD');
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.message).toContain('longer than 3');
    expect(!bad.ok && bad.message).toContain('pattern');
  });

  it('parses dates, date-times and durations', () => {
    expect(parseInput(def({ type: 'date' }), '2026-10-07')).toEqual({
      ok: true,
      value: '2026-10-07',
    });
    expect(parseInput(def({ type: 'date' }), '7.10.2026')).toEqual({
      ok: true,
      value: '2026-10-07',
    });
    expect(parseInput(def({ type: 'date' }), '31.2.2026').ok).toBe(false);
    expect(parseInput(def({ type: 'date' }), 'soon')).toMatchObject({
      ok: false,
    });
    expect(parseInput(def({ type: 'date-time' }), '2026-10-07 09:30')).toEqual({
      ok: true,
      value: '2026-10-07T09:30',
    });
    expect(parseInput(def({ type: 'date-time' }), 'x').ok).toBe(false);
    expect(parseInput(def({ type: 'duration' }), 'pt90m')).toEqual({
      ok: true,
      value: 'PT90M',
    });
    expect(parseInput(def({ type: 'duration' }), '90')).toMatchObject({
      ok: false,
    });
  });

  it('checks links by target', () => {
    const l = def({ type: 'link', target: 'url' });
    expect(parseInput(l, ' https://example.com ')).toEqual({
      ok: true,
      value: 'https://example.com',
    });
    expect(parseInput(l, 'plan.pdf').ok).toBe(false);
    expect(parseInput(l, '')).toEqual({ ok: true, value: null });
  });

  it('refuses attributes that are not typed', () => {
    expect(parseInput(def({ type: 'boolean' }), 'yes').ok).toBe(false);
  });
});

describe('editCommands', () => {
  it('gives one setAttribute per target', () => {
    const cmds = editCommands(
      [{ id: 'el_a' }, { id: 'cn_b' }],
      def({ type: 'text' }),
      'v',
    );
    expect(cmds).toEqual([
      { type: 'setAttribute', target: 'el_a', attr: 'att_x', value: 'v' },
      { type: 'setAttribute', target: 'cn_b', attr: 'att_x', value: 'v' },
    ]);
  });

  it('writes nothing for formula and action attributes', () => {
    expect(
      editCommands([{ id: 'el_a' }], def({ type: 'formula', formula: '1' }), 1),
    ).toEqual([]);
  });
});
