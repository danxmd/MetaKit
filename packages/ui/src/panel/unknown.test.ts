import { describe, expect, it } from 'vitest';
import { unknownAttributes } from './unknown';
import { loadTool } from './testing';

const tool = loadTool('bpmn-lite');

describe('unknownAttributes', () => {
  it('lists values whose attribute the class no longer defines', () => {
    const attrs = { att_name: 'A', att_gone: 'old', att_other: 3 };
    expect(unknownAttributes(tool, 'cls_task', attrs as never)).toEqual([
      { id: 'att_gone', value: 'old' },
      { id: 'att_other', value: 3 },
    ]);
  });

  it('lists nothing when every value is known, or for an unknown class', () => {
    expect(
      unknownAttributes(tool, 'cls_task', { att_name: 'A' } as never),
    ).toEqual([]);
    expect(unknownAttributes(tool, 'cls_removed', { x: 1 } as never)).toEqual(
      [],
    );
  });

  it('works for relation classes and model types', () => {
    const relation = Object.keys(tool.relations)[0]!;
    expect(unknownAttributes(tool, relation, { att_zz: true })).toEqual([
      { id: 'att_zz', value: true },
    ]);
    const modelType = Object.keys(tool.modelTypes)[0]!;
    expect(unknownAttributes(tool, modelType, { att_zz: 1 })).toEqual([
      { id: 'att_zz', value: 1 },
    ]);
  });
});
