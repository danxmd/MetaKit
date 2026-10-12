import { describe, expect, it } from 'vitest';
import {
  createModelStore,
  type ElementId,
  type Model,
} from '@metakit-app/core';
import { SAMPLE, emptySampleModel, sampleKit } from '@metakit-app/core/testing';
import { findAcrossModels, groupHits, type FindAllEntry } from './find-all';

const kit = sampleKit();

function entry(
  slug: string,
  names: string[],
  priority = 'Medium',
): FindAllEntry {
  const store = createModelStore(emptySampleModel(), { kit });
  const commands = names.map((name, i) => ({
    type: 'createElement' as const,
    class: SAMPLE.task,
    x: i * 10,
    y: 0,
    attrs: { [SAMPLE.attName]: name, [SAMPLE.attPriority]: priority },
  }));
  const r = store.execute({ type: 'batch', commands });
  if (!r.ok) throw new Error(r.reason);
  return { slug, name: `Model ${slug}`, model: store.state as Model, kit };
}

describe('findAcrossModels', () => {
  const entries = [
    entry('a', ['Approve invoice', 'Pay supplier']),
    entry('b', ['Invoice archive'], 'High'),
  ];

  it('finds labels across models and reports where', () => {
    const hits = findAcrossModels(entries, 'INVOICE');
    expect(hits.map((h) => [h.slug, h.title, h.matched])).toEqual([
      ['a', 'Approve invoice', 'label'],
      ['b', 'Invoice archive', 'label'],
    ]);
    expect(hits[0]).toMatchObject({
      modelName: 'Model a',
      snippet: 'Approve invoice',
    });
    expect(hits[0]!.element).toMatch(/^el_/);
  });

  it('matches attribute values, ignoring accents', () => {
    const hits = findAcrossModels(entries, 'hîgh');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      slug: 'b',
      matched: 'attribute-value',
      field: 'Priority',
    });
  });

  it('matches class names and attribute keys', () => {
    const cls = kit.classes[SAMPLE.task]!.labels.en ?? 'Task';
    const byClass = findAcrossModels(entries, cls.toLowerCase());
    expect(byClass.length).toBeGreaterThan(0);
    expect(
      byClass.every((h) => h.matched === 'class' || h.matched === 'label'),
    ).toBe(true);
    const byKey = findAcrossModels([entries[0]!], 'priorit');
    expect(byKey.some((h) => h.matched === 'attribute-key')).toBe(true);
  });

  it('puts label matches before weaker ones within a model', () => {
    const hits = findAcrossModels([entries[0]!], 'pay');
    expect(hits[0]).toMatchObject({ title: 'Pay supplier', matched: 'label' });
  });

  it('returns nothing for an empty or unmatched query', () => {
    expect(findAcrossModels(entries, '   ')).toEqual([]);
    expect(findAcrossModels(entries, 'zzzzqq')).toEqual([]);
  });

  it('stops at the limit', () => {
    const big = entry(
      'big',
      Array.from({ length: 300 }, (_, i) => `Item ${i}`),
    );
    expect(findAcrossModels([big], 'item')).toHaveLength(200);
    expect(findAcrossModels([big], 'item', { limit: 5 })).toHaveLength(5);
  });

  it('skips an element whose class is unknown instead of failing', () => {
    const e = entry('c', ['Known']);
    const model = structuredClone(e.model);
    const id = Object.keys(model.elements)[0] as ElementId;
    model.elements[id]!.class = 'cls_missing' as never;
    expect(() => findAcrossModels([{ ...e, model }], 'known')).not.toThrow();
  });

  const workspace = (perModel: number) =>
    Array.from({ length: 50 }, (_, m) =>
      entry(
        `m${m}`,
        Array.from(
          { length: perModel },
          (_, i) => `Step ${m}-${i} of the process`,
        ),
      ),
    );

  it('searches a 50-model workspace of 60 elements each in under 100 ms, first time', () => {
    const models = workspace(60);
    const started = performance.now();
    const hits = findAcrossModels(models, 'no such text anywhere');
    const elapsed = performance.now() - started;
    expect(hits).toEqual([]);
    expect(elapsed).toBeLessThan(100);
  });

  it('keeps a 50-model workspace of 200 elements each under 100 ms once warm', () => {
    const models = workspace(200);
    // The first run pays for the engine compiling the code.
    findAcrossModels(models, 'no such text anywhere');
    findAcrossModels(models, 'no such text anywhere');
    const started = performance.now();
    const hits = findAcrossModels(models, 'no such text anywhere');
    expect(hits).toEqual([]);
    expect(performance.now() - started).toBeLessThan(100);
    // A query that matches everything stops at the limit.
    expect(findAcrossModels(models, 'step')).toHaveLength(200);
  });

  it('groups hits by model, numbering them across the list', () => {
    const groups = groupHits(findAcrossModels(entries, 'invoice'));
    expect(groups.map((g) => [g.slug, g.items.map((i) => i.n)])).toEqual([
      ['a', [0]],
      ['b', [1]],
    ]);
    expect(groupHits([])).toEqual([]);
  });
});
