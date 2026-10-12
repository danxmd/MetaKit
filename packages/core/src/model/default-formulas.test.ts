import { describe, expect, it } from 'vitest';
import { SAMPLE, emptySampleModel, sampleKit } from '../testing/sample-kit';
import { createModelStore, type ModelStore } from './commands';
import type { Kit } from '../meta/types';
import type { ElementId } from '../ids';

const withDefaults = (formulas: {
  created?: string;
  label?: string;
}): ModelStore => {
  const base = sampleKit();
  const task = base.classes[SAMPLE.task]!;
  const kit = {
    ...base,
    classes: {
      ...base.classes,
      [SAMPLE.task]: {
        ...task,
        attributes: [
          ...task.attributes,
          {
            id: 'att_created',
            key: 'Created',
            type: 'text',
            defaultFormula: formulas.created,
          },
          {
            id: 'att_label',
            key: 'Label',
            type: 'text',
            defaultFormula: formulas.label,
          },
        ],
      },
    },
  } as unknown as Kit;
  return createModelStore(emptySampleModel(), { kit });
};

const make = (store: ModelStore, attrs?: Record<string, unknown>): string => {
  const r = store.execute({
    type: 'createElement',
    class: SAMPLE.task,
    x: 0,
    y: 0,
    ...(attrs ? { attrs } : {}),
  } as never);
  if (!r.ok) throw new Error(r.reason);
  return r.value as string;
};

const attrsOf = (store: ModelStore, id: string) =>
  store.state.elements[id as ElementId]!.attrs as Record<string, unknown>;

describe('default formulas', () => {
  it('evaluates today() and a default that reads an earlier attribute', () => {
    const store = withDefaults({
      created: '= today()',
      label: '= Name + " / " + Priority',
    });
    const id = make(store);
    expect(attrsOf(store, id)['att_created']).toBe(
      new Date().toISOString().slice(0, 10),
    );
    expect(attrsOf(store, id)['att_label']).toBe('New / Medium');
  });

  it('keeps a given value and sees the given values', () => {
    const store = withDefaults({ created: '= today()', label: '= Name' });
    const id = make(store, { [SAMPLE.attName]: 'Review', att_created: 'x' });
    expect(attrsOf(store, id)['att_created']).toBe('x');
    expect(attrsOf(store, id)['att_label']).toBe('Review');
  });

  it('leaves the attribute empty when the formula fails, and still creates', () => {
    const store = withDefaults({ created: '= 1 +', label: '= Nope' });
    const id = make(store);
    expect(attrsOf(store, id)['att_created']).toBeUndefined();
    expect(attrsOf(store, id)['att_label']).toBeUndefined();
  });
});
