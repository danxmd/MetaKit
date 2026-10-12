import { describe, expect, it } from 'vitest';
import { SAMPLE, emptySampleModel, sampleKit } from '../testing/sample-kit';
import { CommandError } from '../store/tx';
import { validateModel } from '../validation/validate';
import { createModelStore, type ModelStore } from './commands';
import type { ElementId } from '../ids';

const kit = sampleKit();
const fresh = (): ModelStore => createModelStore(emptySampleModel(), { kit });
const created = (
  store: ModelStore,
  cmd: Parameters<ModelStore['execute']>[0],
): string => {
  const r = store.execute(cmd);
  if (!r.ok) throw new Error(r.reason);
  return r.value as string;
};
const task = (store: ModelStore) =>
  created(store, {
    type: 'createElement',
    class: SAMPLE.task,
    x: 0,
    y: 0,
  }) as ElementId;
const withStale = () => {
  const store = fresh();
  const a = created(store, {
    type: 'createElement',
    class: SAMPLE.task,
    x: 0,
    y: 0,
    // An id the class does not define: what is left behind when a Kit removes an attribute.
    attrs: { att_removed: 'legacy' } as never,
  }) as ElementId;
  return { store, a };
};

describe('remove attribute value', () => {
  it('removes a value the class no longer defines, in one undo step', () => {
    const { store, a } = withStale();
    const steps = store.history().length;
    store.execute({
      type: 'removeAttributeValue',
      target: a,
      attr: 'att_removed',
    });
    expect(store.state.elements[a]!.attrs).not.toHaveProperty('att_removed');
    expect(store.history().length).toBe(steps + 1);
    expect(store.undo()).toBe(true);
    expect(store.state.elements[a]!.attrs).toHaveProperty(
      'att_removed',
      'legacy',
    );
  });

  it('refuses a value of an attribute the class still defines', () => {
    const { store, a } = withStale();
    const before = store.state;
    expect(() =>
      store.execute({
        type: 'removeAttributeValue',
        target: a,
        attr: SAMPLE.attName,
      }),
    ).toThrow(/still defined/);
    expect(store.state).toBe(before);
  });

  it('works for connectors and refuses the model attributes that exist', () => {
    const store = fresh();
    const a = task(store);
    const b = task(store);
    const cn = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: b,
      attrs: { att_gone: 1 } as never,
    });
    store.execute({
      type: 'removeAttributeValue',
      target: cn as never,
      attr: 'att_gone',
    });
    expect(store.state.connectors[cn as never]!.attrs).not.toHaveProperty(
      'att_gone',
    );
    expect(() =>
      store.execute({
        type: 'removeAttributeValue',
        target: 'model',
        attr: SAMPLE.attTitle,
      }),
    ).toThrow(CommandError);
  });

  it('removes unknown model attribute values', () => {
    const store = fresh();
    store.execute({
      type: 'setAttribute',
      target: 'model',
      attr: SAMPLE.attTitle,
      value: 'x',
    });
    // Seed through a model with a leftover value.
    const model = emptySampleModel();
    (model.attrs as Record<string, unknown>).att_old = 'old';
    const other = createModelStore(model, { kit });
    other.execute({
      type: 'removeAttributeValue',
      target: 'model',
      attr: 'att_old',
    });
    expect(other.state.attrs).not.toHaveProperty('att_old');
  });

  it('fails for a missing target and does nothing when there is no value', () => {
    const { store, a } = withStale();
    expect(() =>
      store.execute({
        type: 'removeAttributeValue',
        target: 'el_missing' as ElementId,
        attr: 'att_x',
      }),
    ).toThrow(/does not exist/);
    const steps = store.history().length;
    store.execute({
      type: 'removeAttributeValue',
      target: a,
      attr: 'att_other',
    });
    expect(store.history().length).toBe(steps);
  });

  it('validation only informs about unknown values and goes quiet after removal', () => {
    const { store, a } = withStale();
    const before = validateModel(kit, store.state);
    expect(
      before
        .filter((i) => i.code === 'unknown-attribute')
        .map((i) => i.severity),
    ).toEqual(['info']);
    store.execute({
      type: 'removeAttributeValue',
      target: a,
      attr: 'att_removed',
    });
    expect(
      validateModel(kit, store.state).some(
        (i) => i.code === 'unknown-attribute',
      ),
    ).toBe(false);
  });
});
