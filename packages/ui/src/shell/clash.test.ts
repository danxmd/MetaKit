import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createEmptyModel,
  createModelStore,
  type Model,
  type Kit,
} from '@metakit-app/core';
import { describeClash } from './clash';

const kit = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../kits/bpmn-lite/kit.json', import.meta.url),
    ),
    'utf8',
  ),
) as Kit;

describe('describeClash', () => {
  const store = createModelStore(
    createEmptyModel(kit, Object.keys(kit.modelTypes)[0] as never, {
      name: 'M',
    }),
    { kit },
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
      kit,
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
        kit,
        model,
        { path: ['elements', id, 'x'], mine: 1, theirs: 2, by: 'b' },
        'Ben',
      ),
    ).toContain('the position of "Review order"');
    expect(
      describeClash(
        kit,
        model,
        { path: ['elements', id, 'w'], mine: 1, theirs: 2, by: 'b' },
        'Ben',
      ),
    ).toContain('the size');
    expect(
      describeClash(
        kit,
        model,
        { path: ['manifest', 'name'], mine: 'a', theirs: 'b', by: 'b' },
        'Ben',
      ),
    ).toContain('the model name');
  });

  it('still gives a notice for something it does not know', () => {
    expect(
      describeClash(
        kit,
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
