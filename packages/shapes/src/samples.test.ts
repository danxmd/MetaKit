import type { AttributeDef } from '@metakit-app/core';
import { describe, expect, it } from 'vitest';
import { sampleValuesFor } from './samples';

describe('sampleValuesFor', () => {
  it('gives a value for each type, by attribute id', () => {
    const defs = [
      {
        id: 'att_a',
        key: 'Priority',
        type: 'choice',
        options: ['High', { value: 'Low' }],
      },
      { id: 'att_b', key: 'Effort', type: 'number' },
      { id: 'att_c', key: 'Name', type: 'text' },
      { id: 'att_d', key: 'Done', type: 'boolean' },
      { id: 'att_e', key: 'Owner', type: 'reference', target: {} },
      {
        id: 'att_f',
        key: 'Steps',
        type: 'table',
        columns: [
          { id: 'c1', key: 'Step', type: 'text' },
          { id: 'c2', key: 'Hours', type: 'integer' },
        ],
      },
      { id: 'att_g', key: 'Tags', type: 'multi-choice', options: ['x'] },
      { id: 'att_h', key: 'Due', type: 'date' },
    ] as AttributeDef[];
    expect(sampleValuesFor(defs)).toEqual({
      att_a: 'High',
      att_b: 3,
      att_c: 'Name',
      att_d: true,
      att_e: null,
      att_f: [
        { c1: 'Step 1', c2: 3 },
        { c1: 'Step 2', c2: 4 },
      ],
      att_g: ['x'],
      att_h: '2026-01-15',
    });
  });

  it('copes with a choice without options', () => {
    const defs = [
      { id: 'att_a', key: 'P', type: 'choice', options: [] },
    ] as AttributeDef[];
    expect(sampleValuesFor(defs)).toEqual({ att_a: null });
  });

  it('is empty for no attributes', () => {
    expect(sampleValuesFor([])).toEqual({});
  });
});
