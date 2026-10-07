import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createEmptyModel,
  createModelStore,
  type ElementId,
  type Model,
  type ReferenceAttribute,
  type ToolLibrary,
} from '@metakit-app/core';
import { ReferenceIndex, referenceValue } from './references';

const tool = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../tools/bpmn-lite/tool.json', import.meta.url),
    ),
    'utf8',
  ),
) as ToolLibrary;
const type = Object.values(tool.modelTypes)[0]!;

function modelWith(
  name: string,
  tasks: string[],
): { model: Model; ids: ElementId[] } {
  const store = createModelStore(createEmptyModel(tool, type.id, { name }), {
    tool,
  });
  const ids = tasks.map(
    (t, i) =>
      (
        store.execute({
          type: 'createElement',
          class: i === 1 ? 'cls_gateway' : 'cls_task',
          x: i * 150,
          y: 0,
          attrs: { att_name: t },
        }) as unknown as { value: ElementId }
      ).value,
  );
  return { model: store.state as Model, ids };
}

const owner = tool.classes['cls_task']!.attributes.find(
  (a) => a.key === 'Owner',
) as ReferenceAttribute;

describe('ReferenceIndex', () => {
  const a = modelWith('Sales', ['Pick order', 'Decide', 'Pack']);
  const b = modelWith('Support', ['Answer call', 'Pick up']);
  const index = new ReferenceIndex(async () =>
    [a, b].map(({ model }, i) => ({
      entry: {
        slug: `m${i}`,
        id: model.manifest.id,
        name: model.manifest.name,
        tool: model.manifest.tool,
        modelType: model.manifest.modelType,
      },
      model,
      tool,
    })),
  );

  it('searches across models by name', async () => {
    const hits = await index.search('pick', { ...owner, target: {} });
    expect(hits.map((h) => `${h.modelName}:${h.title}`).sort()).toEqual([
      'Sales:Pick order',
      'Support:Pick up',
    ]);
  });

  it('lists everything for an empty query, up to the limit', async () => {
    const all = await index.search('', { ...owner, target: {} });
    expect(all).toHaveLength(5);
    expect(
      await index.search('', { ...owner, target: {} }, 'en', 2),
    ).toHaveLength(2);
  });

  it('limits the search to the classes the attribute allows', async () => {
    const hits = await index.search('', {
      ...owner,
      target: { classes: ['cls_gateway'] },
    });
    expect(hits.map((h) => h.title)).toEqual(['Decide', 'Pick up']);
    expect(
      await index.search('', {
        ...owner,
        target: { modelTypes: ['mt_other00000'] },
      }),
    ).toEqual([]);
  });

  it('resolves a stored reference, and says nothing about one that is gone', async () => {
    await index.ready();
    const [hit] = await index.search('answer', { ...owner, target: {} });
    expect(index.resolve(referenceValue(hit!) as never)).toMatchObject({
      title: 'Answer call',
      modelName: 'Support',
      slug: 'm1',
    });
    expect(index.resolve({ element: 'el_gone000000' })).toBeUndefined();
  });
});
