import { describe, expect, it } from 'vitest';
import { SAMPLE, emptySampleModel, sampleKit } from '../testing/sample-kit';
import { CommandError } from '../store/tx';
import { createModelStore, type ModelStore } from './commands';
import { inDrawingOrder, type Model } from './types';
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
const task = (store: ModelStore, x = 0, y = 0) =>
  created(store, {
    type: 'createElement',
    class: SAMPLE.task,
    x,
    y,
  }) as ElementId;
const fails = (
  store: ModelStore,
  cmd: Parameters<ModelStore['execute']>[0],
  message: RegExp,
) => {
  const before = store.state;
  expect(() => store.execute(cmd)).toThrow(CommandError);
  expect(() => store.execute(cmd)).toThrow(message);
  expect(store.state).toBe(before);
  expect(store.canUndo()).toBe(store.history().length > 0);
};

describe('create element', () => {
  it('fills defaults, including inherited ones', () => {
    const store = fresh();
    const id = task(store, 10, 20);
    const el = store.state.elements[id]!;
    expect(el).toMatchObject({
      class: SAMPLE.task,
      x: 10,
      y: 20,
      w: 120,
      h: 60,
    });
    expect(el.attrs).toEqual({
      [SAMPLE.attName]: 'New',
      [SAMPLE.attPriority]: 'Medium',
    });
    expect(id).toMatch(/^el_/);
  });

  it('lets given attributes override defaults', () => {
    const store = fresh();
    const id = created(store, {
      type: 'createElement',
      class: SAMPLE.task,
      x: 0,
      y: 0,
      attrs: { [SAMPLE.attName]: 'Review' },
    });
    expect(store.state.elements[id as ElementId]!.attrs[SAMPLE.attName]).toBe(
      'Review',
    );
    expect(
      store.state.elements[id as ElementId]!.attrs[SAMPLE.attPriority],
    ).toBe('Medium');
  });

  it('refuses abstract classes and unknown classes', () => {
    const store = fresh();
    fails(
      store,
      { type: 'createElement', class: SAMPLE.flowNode, x: 0, y: 0 },
      /"FlowNode" is abstract/,
    );
    fails(
      store,
      { type: 'createElement', class: 'cls_nope', x: 0, y: 0 },
      /does not exist in the Kit/,
    );
  });

  it('refuses bad geometry, a missing container and clashing ids', () => {
    const store = fresh();
    fails(
      store,
      { type: 'createElement', class: SAMPLE.task, x: Number.NaN, y: 0 },
      /x must be a number/,
    );
    fails(
      store,
      { type: 'createElement', class: SAMPLE.task, x: 0, y: 0, w: 0 },
      /width must be above 0/,
    );
    fails(
      store,
      {
        type: 'createElement',
        class: SAMPLE.task,
        x: 0,
        y: 0,
        parent: 'el_ghost',
      },
      /container el_ghost does not exist/,
    );
    const id = task(store);
    fails(
      store,
      { type: 'createElement', class: SAMPLE.task, x: 0, y: 0, id },
      /already exists/,
    );
    fails(
      store,
      {
        type: 'createElement',
        class: SAMPLE.task,
        x: 0,
        y: 0,
        id: 'wrong' as ElementId,
      },
      /not an element id/,
    );
  });

  it('puts new elements on top', () => {
    const store = fresh();
    const a = task(store);
    const b = task(store);
    const c = task(store);
    expect(inDrawingOrder(store.state.elements).map((e) => e.id)).toEqual([
      a,
      b,
      c,
    ]);
  });

  it('checks structure only when no Kit is given', () => {
    const store = createModelStore(emptySampleModel());
    const id = created(store, {
      type: 'createElement',
      class: 'cls_anything',
      x: 0,
      y: 0,
    });
    expect(store.state.elements[id as ElementId]!.attrs).toEqual({});
    expect(() =>
      store.execute({
        type: 'createElement',
        class: 'notaclass' as never,
        x: 0,
        y: 0,
      }),
    ).toThrow(/not a class id/);
  });
});

describe('set attribute', () => {
  it('sets values on elements, connectors and the model', () => {
    const store = fresh();
    const a = task(store);
    const b = task(store);
    const cn = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: b,
    });
    store.execute({
      type: 'setAttribute',
      target: a,
      attr: SAMPLE.attEffort,
      value: 3.5,
    });
    store.execute({
      type: 'setAttribute',
      target: cn as never,
      attr: SAMPLE.attCondition,
      value: 'yes',
    });
    store.execute({
      type: 'setAttribute',
      target: 'model',
      attr: SAMPLE.attTitle,
      value: 'Orders',
    });
    expect(store.state.elements[a]!.attrs[SAMPLE.attEffort]).toBe(3.5);
    expect(
      store.state.connectors[cn as never]!.attrs[SAMPLE.attCondition],
    ).toBe('yes');
    expect(store.state.attrs[SAMPLE.attTitle]).toBe('Orders');
  });

  it('does nothing, and records nothing, when the value is unchanged', () => {
    const store = fresh();
    const a = task(store);
    store.execute({
      type: 'setAttribute',
      target: a,
      attr: SAMPLE.attEffort,
      value: 1,
    });
    const before = store.state;
    const r = store.execute({
      type: 'setAttribute',
      target: a,
      attr: SAMPLE.attEffort,
      value: 1,
    });
    expect(r.ok && r.patches).toEqual([]);
    expect(store.state).toBe(before);
    expect(store.history()).toHaveLength(2);
  });

  it('refuses unknown targets, unknown attributes, calculated attributes and non-data', () => {
    const store = fresh();
    const a = task(store);
    fails(
      store,
      {
        type: 'setAttribute',
        target: 'el_ghost',
        attr: SAMPLE.attEffort,
        value: 1,
      },
      /does not exist/,
    );
    fails(
      store,
      {
        type: 'setAttribute',
        target: 'cn_ghost',
        attr: SAMPLE.attEffort,
        value: 1,
      },
      /does not exist/,
    );
    fails(
      store,
      {
        type: 'setAttribute',
        target: 'weird' as never,
        attr: SAMPLE.attEffort,
        value: 1,
      },
      /neither an element/,
    );
    fails(
      store,
      { type: 'setAttribute', target: a, attr: 'att_nope', value: 1 },
      /has no attribute att_nope/,
    );
    fails(
      store,
      { type: 'setAttribute', target: a, attr: SAMPLE.attCost, value: 1 },
      /calculated and cannot be set/,
    );
    fails(
      store,
      {
        type: 'setAttribute',
        target: a,
        attr: SAMPLE.attEffort,
        value: (() => 1) as never,
      },
      /plain JSON data/,
    );
    fails(
      store,
      {
        type: 'setAttribute',
        target: a,
        attr: SAMPLE.attEffort,
        value: undefined as never,
      },
      /plain JSON data/,
    );
    fails(
      store,
      {
        type: 'setAttribute',
        target: a,
        attr: SAMPLE.attEffort,
        value: Number.NaN,
      },
      /plain JSON data/,
    );
    fails(
      store,
      {
        type: 'setAttribute',
        target: a,
        attr: 'notanattribute' as never,
        value: 1,
      },
      /not an attribute id/,
    );
  });

  it('accepts content problems, which validation reports', () => {
    const store = fresh();
    const a = task(store);
    expect(
      store.execute({
        type: 'setAttribute',
        target: a,
        attr: SAMPLE.attEffort,
        value: 'lots',
      }).ok,
    ).toBe(true);
  });
});

describe('move, resize, bends', () => {
  it('moves and resizes', () => {
    const store = fresh();
    const a = task(store);
    store.execute({ type: 'move', id: a, x: 200, y: 100 });
    store.execute({ type: 'resize', id: a, w: 150, h: 80 });
    expect(store.state.elements[a]).toMatchObject({
      x: 200,
      y: 100,
      w: 150,
      h: 80,
    });
  });

  it('resizes from the top left', () => {
    const store = fresh();
    const a = task(store, 100, 100);
    store.execute({ type: 'resize', id: a, w: 200, h: 100, x: 50, y: 60 });
    expect(store.state.elements[a]).toMatchObject({
      x: 50,
      y: 60,
      w: 200,
      h: 100,
    });
  });

  it('moves into and out of a container, but not into itself', () => {
    const store = fresh();
    const lane = created(store, {
      type: 'createElement',
      class: SAMPLE.lane,
      x: 0,
      y: 0,
      w: 500,
      h: 200,
    }) as ElementId;
    const a = task(store);
    store.execute({ type: 'move', id: a, x: 10, y: 10, parent: lane });
    expect(store.state.elements[a]!.parent).toBe(lane);
    store.execute({ type: 'move', id: a, x: 20, y: 10 });
    expect(store.state.elements[a]!.parent).toBe(lane);
    store.execute({ type: 'move', id: a, x: 20, y: 10, parent: null });
    expect('parent' in store.state.elements[a]!).toBe(false);
    fails(
      store,
      { type: 'move', id: lane, x: 0, y: 0, parent: lane },
      /into itself/,
    );
    store.execute({ type: 'move', id: a, x: 0, y: 0, parent: lane });
    fails(
      store,
      { type: 'move', id: lane, x: 0, y: 0, parent: a },
      /into itself or into something it contains/,
    );
  });

  it('refuses unknown elements and bad numbers', () => {
    const store = fresh();
    const a = task(store);
    fails(
      store,
      { type: 'move', id: 'el_ghost', x: 0, y: 0 },
      /does not exist/,
    );
    fails(
      store,
      { type: 'move', id: a, x: Number.POSITIVE_INFINITY, y: 0 },
      /x must be a number/,
    );
    fails(store, { type: 'resize', id: a, w: -1, h: 10 }, /above 0/);
  });

  it('sets bend points', () => {
    const store = fresh();
    const a = task(store);
    const b = task(store);
    const cn = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: b,
    }) as never;
    store.execute({
      type: 'setBends',
      id: cn,
      bends: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
    });
    expect(store.state.connectors[cn]!.bends).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    fails(
      store,
      { type: 'setBends', id: cn, bends: [{ x: 1 } as never] },
      /y must be a number/,
    );
  });
});

describe('connectors', () => {
  it('connects and reconnects', () => {
    const store = fresh();
    const a = task(store);
    const b = task(store);
    const c = task(store);
    const cn = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: b,
    }) as never;
    expect(store.state.connectors[cn]).toMatchObject({
      from: a,
      to: b,
      bends: [],
      relation: SAMPLE.flow,
    });
    store.execute({ type: 'reconnect', id: cn, to: c });
    expect(store.state.connectors[cn]).toMatchObject({
      from: a,
      to: c,
      relation: SAMPLE.flow,
    });
    store.execute({ type: 'reconnect', id: cn, from: b });
    expect(store.state.connectors[cn]).toMatchObject({ from: b, to: c });
  });

  it('refuses unknown ends, unknown relations and empty reconnects', () => {
    const store = fresh();
    const a = task(store);
    fails(
      store,
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: 'el_ghost',
        to: a,
      },
      /FROM element el_ghost does not exist/,
    );
    fails(
      store,
      {
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: a,
        to: 'el_ghost',
      },
      /TO element el_ghost does not exist/,
    );
    fails(
      store,
      { type: 'createConnector', relation: 'rel_nope', from: a, to: a },
      /does not exist in the Kit/,
    );
    const cn = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: a,
    }) as never;
    fails(store, { type: 'reconnect', id: cn }, /needs a new FROM element/);
    fails(
      store,
      { type: 'reconnect', id: cn, to: 'el_ghost' },
      /does not exist/,
    );
    fails(
      store,
      { type: 'reconnect', id: 'cn_ghost' as never, to: a },
      /does not exist/,
    );
  });

  it('allows connections the relation does not permit, so that validation can report them', () => {
    const store = fresh();
    const lane = created(store, {
      type: 'createElement',
      class: SAMPLE.lane,
      x: 0,
      y: 0,
    }) as ElementId;
    const a = task(store);
    expect(
      store.execute({
        type: 'createConnector',
        relation: SAMPLE.flow,
        from: lane,
        to: a,
      }).ok,
    ).toBe(true);
  });
});

describe('delete', () => {
  it('removes an element with its connectors, and undo restores all of them', () => {
    const store = fresh();
    const a = task(store);
    const b = task(store);
    const c = task(store);
    const c1 = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: b,
    });
    const c2 = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: b,
      to: c,
    });
    const c3 = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: c,
      to: b,
    });
    const keep = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: c,
    });
    const before = store.state;
    store.execute({ type: 'delete', id: b });
    expect(Object.keys(store.state.elements).sort()).toEqual([a, c].sort());
    expect(Object.keys(store.state.connectors)).toEqual([keep]);
    expect([c1, c2, c3].some((id) => id in store.state.connectors)).toBe(false);
    expect(store.undo()).toBe(true);
    expect(store.state).toEqual(before);
    expect(store.undo()).toBe(true);
    expect(Object.keys(store.state.connectors)).toHaveLength(3);
  });

  // Changed in 4.4: a deleted container no longer takes its contents with it. They move up to the
  // container's own container (or the top level) and keep their connectors.
  it('keeps the contents of a deleted container and moves them up', () => {
    const store = fresh();
    const lane = created(store, {
      type: 'createElement',
      class: SAMPLE.lane,
      x: 0,
      y: 0,
    }) as ElementId;
    const inner = created(store, {
      type: 'createElement',
      class: SAMPLE.task,
      x: 5,
      y: 5,
      parent: lane,
    }) as ElementId;
    const deeper = created(store, {
      type: 'createElement',
      class: SAMPLE.task,
      x: 5,
      y: 5,
      parent: inner,
    }) as ElementId;
    const outside = task(store);
    created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: deeper,
      to: outside,
    });
    store.execute({ type: 'delete', id: lane });
    expect(Object.keys(store.state.elements).sort()).toEqual(
      [inner, deeper, outside].sort(),
    );
    expect('parent' in store.state.elements[inner]!).toBe(false);
    expect(store.state.elements[deeper]!.parent).toBe(inner);
    expect(Object.keys(store.state.connectors)).toHaveLength(1);
    expect(store.history().at(-1)).toBe('delete');
    store.execute({ type: 'delete', id: inner });
    expect('parent' in store.state.elements[deeper]!).toBe(false);
  });

  it('deletes a single connector', () => {
    const store = fresh();
    const a = task(store);
    const cn = created(store, {
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: a,
    });
    store.execute({ type: 'delete', id: cn as never });
    expect(store.state.connectors).toEqual({});
    expect(Object.keys(store.state.elements)).toEqual([a]);
    fails(store, { type: 'delete', id: cn as never }, /does not exist/);
    fails(store, { type: 'delete', id: 'el_ghost' }, /does not exist/);
  });
});

describe('reorder', () => {
  const order = (store: ModelStore) =>
    inDrawingOrder(store.state.elements).map((e) => e.id);

  it('sends to the front and back and moves before and after others, changing only that key', () => {
    const store = fresh();
    const [a, b, c, d] = [
      task(store),
      task(store),
      task(store),
      task(store),
    ] as ElementId[];
    const keysBefore = Object.fromEntries(
      Object.values(store.state.elements).map((e) => [e.id, e.pos]),
    );
    store.execute({ type: 'reorder', id: a!, to: 'front' });
    expect(order(store)).toEqual([b, c, d, a]);
    store.execute({ type: 'reorder', id: d!, to: 'back' });
    expect(order(store)).toEqual([d, b, c, a]);
    store.execute({ type: 'reorder', id: a!, to: { before: b! } });
    expect(order(store)).toEqual([d, a, b, c]);
    store.execute({ type: 'reorder', id: d!, to: { after: b! } });
    expect(order(store)).toEqual([a, b, d, c]);
    // Only the items that were moved have new keys.
    expect(store.state.elements[c!]!.pos).toBe(keysBefore[c!]);
    expect(store.state.elements[b!]!.pos).toBe(keysBefore[b!]);
  });

  it('does nothing when the item is already where it is asked to go', () => {
    const store = fresh();
    const [a, b] = [task(store), task(store)] as ElementId[];
    const before = store.state;
    store.execute({ type: 'reorder', id: b!, to: 'front' });
    store.execute({ type: 'reorder', id: a!, to: 'back' });
    store.execute({ type: 'reorder', id: a!, to: { before: b! } });
    expect(store.state).toBe(before);
  });

  it('refuses unknown anchors and itself', () => {
    const store = fresh();
    const a = task(store);
    fails(
      store,
      { type: 'reorder', id: a, to: { before: a } },
      /before or after itself/,
    );
    fails(
      store,
      { type: 'reorder', id: a, to: { after: 'el_ghost' } },
      /not among the elements/,
    );
    fails(
      store,
      { type: 'reorder', id: 'el_ghost', to: 'front' },
      /does not exist/,
    );
  });

  it('keeps both items when two users insert after the same element', () => {
    const base = fresh();
    const a = task(base);
    const snapshot = base.state;
    const one = createModelStore(snapshot, { kit });
    const two = createModelStore(snapshot, { kit });
    const x = created(one, {
      type: 'createElement',
      class: SAMPLE.task,
      x: 0,
      y: 0,
    }) as ElementId;
    const y = created(two, {
      type: 'createElement',
      class: SAMPLE.task,
      x: 0,
      y: 0,
    }) as ElementId;
    one.execute({ type: 'reorder', id: x, to: { after: a } });
    two.execute({ type: 'reorder', id: y, to: { after: a } });
    expect(one.state.elements[x]!.pos).not.toBe(two.state.elements[y]!.pos);
  });
});

describe('manifest', () => {
  it('renames, sets the folder and the Kit version', () => {
    const store = fresh();
    store.execute({
      type: 'updateManifest',
      name: 'Order to cash',
      folder: 'Sales/2026',
      kitVersion: '1.1.0',
    });
    expect(store.state.manifest).toMatchObject({
      name: 'Order to cash',
      folder: 'Sales/2026',
      kitVersion: '1.1.0',
    });
    store.execute({ type: 'updateManifest', folder: null });
    expect('folder' in store.state.manifest).toBe(false);
    fails(store, { type: 'updateManifest', name: '  ' }, /cannot be empty/);
    expect(store.state.manifest.id).toBe('mdl_sample');
  });
});

describe('batches', () => {
  it('applies all commands as one step', () => {
    const store = fresh();
    const r = store.execute({
      type: 'batch',
      commands: [
        { type: 'createElement', class: SAMPLE.task, x: 1, y: 1, id: 'el_one' },
        { type: 'createElement', class: SAMPLE.task, x: 2, y: 2, id: 'el_two' },
        {
          type: 'createConnector',
          relation: SAMPLE.flow,
          from: 'el_one',
          to: 'el_two',
          id: 'cn_link',
        },
        { type: 'move', id: 'el_two', x: 50, y: 50 },
        {
          type: 'setAttribute',
          target: 'el_one',
          attr: SAMPLE.attName,
          value: 'Start here',
        },
      ],
    });
    expect(r.ok && r.value).toEqual([
      'el_one',
      'el_two',
      'cn_link',
      undefined,
      undefined,
    ]);
    expect(store.history()).toEqual(['batch']);
    expect(Object.keys(store.state.elements)).toHaveLength(2);
    expect(store.undo()).toBe(true);
    expect(store.state).toEqual(emptySampleModel());
    expect(store.redo()).toBe(true);
    expect(store.state.elements['el_two' as ElementId]!.x).toBe(50);
  });

  it('applies none when one fails', () => {
    const store = fresh();
    const before = store.state;
    expect(() =>
      store.execute({
        type: 'batch',
        commands: [
          { type: 'createElement', class: SAMPLE.task, x: 1, y: 1 },
          { type: 'createElement', class: SAMPLE.task, x: 2, y: 2 },
          { type: 'move', id: 'el_ghost', x: 0, y: 0 },
        ],
      }),
    ).toThrow(/does not exist/);
    expect(store.state).toBe(before);
    expect(store.history()).toEqual([]);
    expect(store.canUndo()).toBe(false);
  });

  it('later commands see the effects of earlier ones', () => {
    const store = fresh();
    store.execute({
      type: 'batch',
      commands: [
        {
          type: 'createElement',
          class: SAMPLE.lane,
          x: 0,
          y: 0,
          id: 'el_lane',
        },
        {
          type: 'createElement',
          class: SAMPLE.task,
          x: 5,
          y: 5,
          parent: 'el_lane',
        },
      ],
    });
    expect(
      Object.values(store.state.elements).find((e) => e.parent === 'el_lane'),
    ).toBeDefined();
  });

  it('can be nested', () => {
    const store = fresh();
    store.execute({
      type: 'batch',
      commands: [
        {
          type: 'batch',
          commands: [{ type: 'createElement', class: SAMPLE.task, x: 0, y: 0 }],
        } as never,
      ],
    });
    expect(Object.keys(store.state.elements)).toHaveLength(1);
    store.undo();
    expect(Object.keys(store.state.elements)).toHaveLength(0);
  });
});

describe('read only state', () => {
  it('cannot be changed through a reference', () => {
    const store = fresh();
    const a = task(store);
    const state = store.state as Model;
    expect(() => {
      (state.elements[a] as { x: number }).x = 999;
    }).toThrow(TypeError);
    expect(() => {
      (state.attrs as Record<string, unknown>).att_x = 1;
    }).toThrow(TypeError);
    expect(() => {
      (state.elements[a]!.attrs as Record<string, unknown>)[SAMPLE.attName] =
        'hacked';
    }).toThrow(TypeError);
    expect(store.state.elements[a]!.x).toBe(0);
  });

  it("does not keep the caller's objects", () => {
    const store = fresh();
    const attrs = { [SAMPLE.attName]: 'Name' };
    const id = created(store, {
      type: 'createElement',
      class: SAMPLE.task,
      x: 0,
      y: 0,
      attrs,
    }) as ElementId;
    attrs[SAMPLE.attName] = 'changed later';
    expect(store.state.elements[id]!.attrs[SAMPLE.attName]).toBe('Name');
  });

  it('does not freeze the initial document passed in', () => {
    const initial = emptySampleModel();
    createModelStore(initial);
    expect(Object.isFrozen(initial)).toBe(false);
  });
});

describe('unknown commands', () => {
  it('are refused', () => {
    expect(() => fresh().execute({ type: 'explode' } as never)).toThrow(
      /Unknown command "explode"/,
    );
  });
});
