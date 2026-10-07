import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createEmptyModel,
  createModelStore,
  type Model,
  type ToolLibrary,
} from '@metakit-app/core';
import { describeClash } from './clash';

const tool = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../tools/bpmn-lite/tool.json', import.meta.url),
    ),
    'utf8',
  ),
) as ToolLibrary;

describe('describeClash', () => {
  const store = createModelStore(
    createEmptyModel(tool, Object.keys(tool.modelTypes)[0] as never, {
      name: 'M',
    }),
    { tool },
  );
  const id = (
    store.execute({
      type: 'createElement',
      class: 'cls_task',
      x: 0,
      y: 0,
      attrs: { att_name: 'Review order' },
    }) as unknown as { value: string }
  ).value;
  const model = store.state as Model;

  it('names the attribute, the object and who won, without paths or ids', () => {
    const text = describeClash(
      tool,
      model,
      {
        path: ['elements', id, 'attrs', 'att_priority'],
        mine: 'Low',
        theirs: 'High',
        by: 'bbbb0002',
      },
      'Anna',
    );
    expect(text).toBe(
      'Anna changed Priority of "Review order" at the same time as you. Anna\'s value was kept.',
    );
    expect(text).not.toMatch(/el_|att_/);
  });

  it('says position or size for geometry, and the model name for the manifest', () => {
    expect(
      describeClash(
        tool,
        model,
        { path: ['elements', id, 'x'], mine: 1, theirs: 2, by: 'b' },
        'Ben',
      ),
    ).toContain('the position of "Review order"');
    expect(
      describeClash(
        tool,
        model,
        { path: ['elements', id, 'w'], mine: 1, theirs: 2, by: 'b' },
        'Ben',
      ),
    ).toContain('the size');
    expect(
      describeClash(
        tool,
        model,
        { path: ['manifest', 'name'], mine: 'a', theirs: 'b', by: 'b' },
        'Ben',
      ),
    ).toContain('the model name');
  });

  it('still gives a notice for something it does not know', () => {
    expect(
      describeClash(
        tool,
        model,
        {
          path: ['elements', 'el_gone', 'whatever'],
          mine: 1,
          theirs: 2,
          by: 'b',
        },
        'Cy',
      ),
    ).toMatch(/^Cy changed whatever/);
  });
});
