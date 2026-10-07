import { describe, expect, it } from 'vitest';
import { SAMPLE, emptySampleModel, sampleTool } from '../testing/sample-tool';
import { CommandError } from '../store/tx';
import { createModelStore, type ModelStore } from './commands';
import type { ConnectorId, ElementId } from '../ids';

const tool = sampleTool();
const fresh = (): ModelStore => createModelStore(emptySampleModel(), { tool });
const make = (store: ModelStore, x = 0, y = 0): ElementId => {
  const r = store.execute({
    type: 'createElement',
    class: SAMPLE.task,
    x,
    y,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.value as ElementId;
};

describe('apply layout', () => {
  it('sets positions, sizes and bends in one undoable step', () => {
    const store = fresh();
    const a = make(store);
    const b = make(store, 300, 0);
    const r = store.execute({
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: b,
    });
    if (!r.ok) throw new Error(r.reason);
    const cn = r.value as ConnectorId;
    const steps = store.history().length;
    store.execute({
      type: 'applyLayout',
      moves: [
        { id: a, x: 10, y: 20 },
        { id: b, x: 50, y: 200 },
      ],
      resizes: [{ id: b, w: 80, h: 40 }],
      bends: [{ id: cn, bends: [{ x: 70, y: 50 }] }],
    });
    expect(store.history().length).toBe(steps + 1);
    expect(store.state.elements[b]).toMatchObject({ x: 50, y: 200, w: 80 });
    expect(store.state.connectors[cn]!.bends).toEqual([{ x: 70, y: 50 }]);
    expect(store.undo()).toBe(true);
    expect(store.state.elements[a]).toMatchObject({ x: 0, y: 0 });
    expect(store.state.elements[b]).toMatchObject({ x: 300, w: 120 });
    expect(store.state.connectors[cn]!.bends).toEqual([]);
  });

  it('changes nothing when one entry is bad', () => {
    const store = fresh();
    const a = make(store);
    const before = store.state;
    expect(() =>
      store.execute({
        type: 'applyLayout',
        moves: [
          { id: a, x: 5, y: 5 },
          { id: 'el_missing' as ElementId, x: 1, y: 1 },
        ],
      }),
    ).toThrow(/does not exist/);
    expect(() =>
      store.execute({
        type: 'applyLayout',
        moves: [{ id: a, x: Number.NaN, y: 1 }],
      }),
    ).toThrow(CommandError);
    expect(store.state).toBe(before);
  });
});
