import { FUNCTION_NAMES } from '@metakit-app/formula';
import { describe, expect, it } from 'vitest';
import { completeNames, namesAtCursor } from './completion';

const ctx = {
  attributes: ['Priority', 'Name', 'Effort', 'TaskType'],
  lets: ['accent', 'priorityColour'],
};

describe('completeNames', () => {
  it('offers the attribute for what was typed', () => {
    expect(completeNames('Pri', ctx)[0]).toEqual({
      name: 'Priority',
      kind: 'attribute',
      insert: 'Priority',
    });
  });

  it('ignores case and puts prefix matches before other matches', () => {
    const names = completeNames('pri', ctx).map((c) => c.name);
    expect(names.slice(0, 2)).toEqual(['Priority', 'priorityColour']);
    const inner = completeNames('type', ctx).map((c) => c.name);
    expect(inner).toContain('TaskType');
  });

  it('puts prefix matches ahead of containing matches', () => {
    const names = completeNames('ar', { attributes: ['Chart', 'Area'] }).map(
      (c) => c.name,
    );
    expect(names[0]).toBe('Area');
    expect(names).toContain('Chart');
  });

  it('offers the $ names', () => {
    expect(completeNames('$', ctx, 20).map((c) => c.name)).toEqual([
      '$class',
      '$fields',
      '$fill',
      '$height',
      '$label',
      '$width',
    ]);
  });

  it('offers formula functions with a bracket to type into', () => {
    const c = completeNames('coal', ctx)[0]!;
    expect(c).toMatchObject({
      name: 'coalesce',
      kind: 'function',
      insert: 'coalesce(',
    });
    expect(FUNCTION_NAMES).toContain('coalesce');
  });

  it('puts attributes before let names before functions when all match', () => {
    const kinds = completeNames('', {
      attributes: ['b'],
      lets: ['a'],
    }).map((c) => c.kind);
    expect(kinds.slice(0, 2)).toEqual(['attribute', 'let']);
  });

  it('limits the list and works without context', () => {
    expect(completeNames('', ctx, 3)).toHaveLength(3);
    expect(completeNames('zzzz', ctx)).toEqual([]);
    expect(completeNames('lab', {}).map((c) => c.name)).toEqual(['$label']);
  });
});

describe('namesAtCursor', () => {
  it('finds the word before the cursor', () => {
    expect(namesAtCursor('= Priority == 1', 5)).toEqual({
      prefix: 'Pri',
      start: 2,
      end: 10,
    });
  });

  it('finds a word at the end', () => {
    expect(namesAtCursor('= Pri', 5)).toEqual({
      prefix: 'Pri',
      start: 2,
      end: 5,
    });
  });

  it('includes the dollar sign', () => {
    expect(namesAtCursor('= $wi', 5)).toEqual({
      prefix: '$wi',
      start: 2,
      end: 5,
    });
  });

  it('gives an empty prefix between words', () => {
    expect(namesAtCursor('= A + ', 6)).toEqual({
      prefix: '',
      start: 6,
      end: 6,
    });
  });

  it('is null inside a quoted text, after a dot and in a number', () => {
    expect(namesAtCursor("= 'Hi the", 9)).toBeNull();
    expect(namesAtCursor('= Owner.Na', 10)).toBeNull();
    expect(namesAtCursor('= 12px', 4)).toBeNull();
  });

  it('knows a closed text is over', () => {
    expect(namesAtCursor("= 'a\\'b' + Na", 13)?.prefix).toBe('Na');
  });
});
