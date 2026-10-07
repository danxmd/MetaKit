import { describe, expect, it } from 'vitest';
import {
  checkAttributeValue,
  type Json,
  type TableAttribute,
} from '@metakit-app/core';
import { parseTablePaste, tableWithPaste } from './table';

const attr: TableAttribute = {
  id: 'att_t',
  key: 'T',
  type: 'table',
  maxRows: 3,
  columns: [
    { id: 'c1', key: 'Item', type: 'text' },
    { id: 'c2', key: 'Hours', type: 'number', labels: { en: 'Hours' } },
    { id: 'c3', key: 'Count', type: 'integer' },
    { id: 'c4', key: 'Done', type: 'boolean' },
    { id: 'c5', key: 'Due', type: 'date' },
    {
      id: 'c6',
      key: 'Level',
      type: 'choice',
      options: ['Low', { value: 'high', labels: { en: 'Very High' } }],
    },
  ],
};

describe('parseTablePaste', () => {
  it('converts two rows by column type', () => {
    const r = parseTablePaste(
      attr,
      'Write\t1,5\t2\tYes\t7.10.2026\tlow\r\nTest\t3\t4\tfalse\t2026-10-08\tvery high\r\n',
    );
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([
      { c1: 'Write', c2: 1.5, c3: 2, c4: true, c5: '2026-10-07', c6: 'Low' },
      { c1: 'Test', c2: 3, c3: 4, c4: false, c5: '2026-10-08', c6: 'high' },
    ]);
    expect(checkAttributeValue(attr, r.rows.slice(0, 2))).toEqual([]);
  });

  it('reports bad cells and leaves them out', () => {
    const r = parseTablePaste(attr, 'a\t1\nb\tx\t1.5\tmaybe\t31.2.2026\tzzz');
    expect(r.rows[0]).toEqual({ c1: 'a', c2: 1 });
    expect(r.rows[1]).toEqual({ c1: 'b' });
    expect(r.problems).toEqual([
      'Row 2, column "Hours": "x" is not a number.',
      'Row 2, column "Count": "1.5" is not a whole number.',
      'Row 2, column "Done": "maybe" is not true or false (or yes, no, 1, 0).',
      'Row 2, column "Due": "31.2.2026" is not a date.',
      'Row 2, column "Level": "zzz" is not one of the options.',
    ]);
  });

  it('starts at a column and warns about extra cells', () => {
    const r = parseTablePaste(attr, '2\t3\t4\t5\t6\t7\t8', 1);
    expect(r.rows[0]).toMatchObject({ c2: 2, c3: 3 });
    expect(r.rows[0]!['c1']).toBeUndefined();
    expect(r.problems.some((p) => p.includes('more cells'))).toBe(true);
  });

  it('drops rows beyond maxRows', () => {
    const r = parseTablePaste(attr, 'a\nb\nc\nd\ne');
    expect(r.rows).toHaveLength(3);
    expect(r.problems[0]).toContain('2 extra rows');
  });

  it('handles empty text, blank cells and quotes', () => {
    expect(parseTablePaste(attr, '').rows).toEqual([]);
    expect(parseTablePaste(attr, '\n').rows).toEqual([]);
    expect(parseTablePaste(attr, 'a\t\t3').rows).toEqual([{ c1: 'a', c3: 3 }]);
    expect(parseTablePaste(attr, '"a\tb ""q""\nz"\t2').rows).toEqual([
      { c1: 'a\tb "q"\nz', c2: 2 },
    ]);
  });
});

describe('tableWithPaste', () => {
  it('overwrites, appends and does not mutate', () => {
    const current: Record<string, Json>[] = [{ c1: 'a', c2: 1 }, { c1: 'b' }];
    const next = tableWithPaste(current, 1, [{ c1: 'B' }, { c1: 'C' }]);
    expect(next).toEqual([{ c1: 'a', c2: 1 }, { c1: 'B' }, { c1: 'C' }]);
    expect(current).toEqual([{ c1: 'a', c2: 1 }, { c1: 'b' }]);
  });

  it('keeps old cells that were not pasted, clamps the start and cuts at maxRows', () => {
    expect(tableWithPaste([{ c1: 'a', c2: 1 }], 0, [{ c2: 5 }])).toEqual([
      { c1: 'a', c2: 5 },
    ]);
    expect(tableWithPaste([{ c1: 'a' }], 9, [{ c1: 'x' }])).toEqual([
      { c1: 'a' },
      { c1: 'x' },
    ]);
    expect(tableWithPaste([], 0, [{}, {}, {}], 2)).toHaveLength(2);
  });
});
