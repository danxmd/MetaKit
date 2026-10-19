import { describe, expect, it } from 'vitest';
import type { ElementId, Model } from '@metakit-app/core';
import { aroundConnectors, Scene } from './scene';
import { BPMN, bpmnStore, emptyModel } from './testing';

function setup() {
  const { kit, store } = bpmnStore();
  const scene = new Scene(store.state as Model, kit);
  scene.attach(store);
  const create = (
    x: number,
    y: number,
    name?: string,
    cls: string = BPMN.task,
  ) => {
    const result = store.execute({
      type: 'createElement',
      class: cls as never,
      x,
      y,
      w: 100,
      h: 50,
      ...(name ? { attrs: { [BPMN.name]: name } } : {}),
    });
    if (!result.ok) throw new Error('cancelled');
    return result.value as ElementId;
  };
  return { kit, store, scene, create };
}

describe('Scene', () => {
  it('follows creates, moves and deletes', () => {
    const { store, scene, create } = setup();
    const a = create(0, 0, 'A');
    const b = create(300, 0, 'B');
    expect(scene.elements.size).toBe(2);
    expect(scene.elementAt({ x: 10, y: 10 })?.id).toBe(a);
    store.execute({ type: 'move', id: a, x: 500, y: 500 });
    expect(scene.elementAt({ x: 10, y: 10 })).toBeUndefined();
    expect(scene.elementAt({ x: 510, y: 510 })?.id).toBe(a);
    store.execute({ type: 'delete', id: b });
    expect(scene.elements.has(b)).toBe(false);
    expect(
      scene.search({ minX: 290, minY: -10, maxX: 410, maxY: 100 }),
    ).toEqual([]);
  });

  it('re-routes connectors when an element moves, and on undo', () => {
    const { store, scene, create } = setup();
    const a = create(0, 0);
    const b = create(300, 0);
    const result = store.execute({
      type: 'createConnector',
      relation: BPMN.flow,
      from: a,
      to: b,
    });
    const cn = (result as unknown as { value: never }).value;
    const before = scene.connectors.get(cn)!.route.map((p) => ({ ...p }));
    store.execute({ type: 'move', id: b, x: 300, y: 200 });
    const moved = scene.connectors.get(cn)!.route;
    expect(moved).not.toEqual(before);
    expect(moved[moved.length - 1]!.y).toBeCloseTo(200);
    store.undo();
    expect(scene.connectors.get(cn)!.route).toEqual(before);
  });

  it('uses the first filled text attribute as the label, else the class name', () => {
    const { store, scene, create } = setup();
    const a = create(0, 0, 'Check order');
    expect(scene.elements.get(a)!.label).toBe('Check order');
    store.execute({
      type: 'setAttribute',
      target: a,
      attr: BPMN.name,
      value: '',
    });
    expect(scene.elements.get(a)!.label).toBe('Task');
  });

  it('keeps the draw list when an element only moves, and rebuilds it on a label or size change', () => {
    const { store, scene, create } = setup();
    const a = create(0, 0, 'A');
    const builds = scene.cache.builds;
    const list = scene.elements.get(a)!.compiled;
    store.execute({ type: 'move', id: a, x: 40, y: 40 });
    expect(scene.cache.builds).toBe(builds);
    expect(scene.elements.get(a)!.compiled).toBe(list);
    store.execute({
      type: 'setAttribute',
      target: a,
      attr: BPMN.name,
      value: 'B',
    });
    expect(scene.cache.builds).toBe(builds + 1);
    store.execute({ type: 'resize', id: a, w: 200, h: 80 });
    expect(scene.cache.builds).toBe(builds + 2);
  });

  it('draws later elements on top, and honours reorder', () => {
    const { store, scene, create } = setup();
    const a = create(0, 0);
    const b = create(10, 10);
    expect(scene.elementAt({ x: 20, y: 20 })?.id).toBe(b);
    store.execute({ type: 'reorder', id: a, to: 'front' });
    expect(scene.elementAt({ x: 20, y: 20 })?.id).toBe(a);
  });

  it('finds connectors near a point and items in a rubber band', () => {
    const { store, scene, create } = setup();
    const a = create(0, 0);
    const b = create(300, 0);
    store.execute({
      type: 'createConnector',
      relation: BPMN.flow,
      from: a,
      to: b,
    });
    const mid = scene.connectorAt({ x: 200, y: 27 }, 4);
    expect(mid).toBeDefined();
    expect(scene.connectorAt({ x: 200, y: 200 }, 4)).toBeUndefined();
    const all = scene.itemsIn({ minX: -10, minY: -10, maxX: 500, maxY: 100 });
    expect(all).toHaveLength(3);
    const some = scene.itemsIn({ minX: -10, minY: -10, maxX: 150, maxY: 100 });
    expect(some.map((i) => i.id)).toEqual([a]);
  });

  it('matches a full rebuild after any sequence of commands, undos and redos', () => {
    const { store, scene, create, kit } = setup();
    const ids: ElementId[] = [];
    for (let i = 0; i < 12; i++)
      ids.push(create(i * 130, (i % 3) * 90, `N${i}`));
    for (let i = 1; i < ids.length; i += 2)
      store.execute({
        type: 'createConnector',
        relation: BPMN.flow,
        from: ids[i - 1]!,
        to: ids[i]!,
      });
    store.execute({ type: 'move', id: ids[3]!, x: 1, y: 2 });
    store.execute({ type: 'delete', id: ids[4]! });
    store.execute({ type: 'reorder', id: ids[0]!, to: 'front' });
    store.undo();
    store.undo();
    store.redo();
    const fresh = new Scene(store.state as Model, kit);
    const view = (s: Scene) => ({
      elements: [...s.elements.values()]
        .map((e) => ({ ...e, compiled: e.compiled.compiled.ops }))
        .sort((a, b) => (a.id < b.id ? -1 : 1)),
      connectors: [...s.connectors.values()].sort((a, b) =>
        a.id < b.id ? -1 : 1,
      ),
      index: s
        .search({ minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 })
        .map((b) => `${b.id}:${b.minX},${b.minY},${b.maxX},${b.maxY}`)
        .sort(),
    });
    expect(view(scene)).toEqual(view(fresh));
  });

  it('ranks containers below every other object, outer ones first', () => {
    const { kit } = bpmnStore();
    const model = emptyModel(kit);
    const el = (
      id: string,
      cls: string,
      pos: string,
      parent?: string,
    ): Model['elements'][ElementId] => ({
      id: id as ElementId,
      class: cls as never,
      x: 0,
      y: 0,
      w: 400,
      h: 200,
      attrs: {},
      pos,
      ...(parent ? { parent: parent as ElementId } : {}),
    });
    // Model order (pos) says: loose task, inner lane, task in it, outer lane on top. A merge can
    // leave the inner lane below its own container like this.
    model.elements = {
      ['el_loose' as ElementId]: el('el_loose', BPMN.task, 'a'),
      ['el_inner' as ElementId]: el('el_inner', BPMN.lane, 'b', 'el_outer'),
      ['el_task' as ElementId]: el('el_task', BPMN.task, 'c', 'el_inner'),
      ['el_outer' as ElementId]: el('el_outer', BPMN.lane, 'd'),
    };
    const scene = new Scene(model, kit);
    const order = [...scene.elements.values()]
      .sort((a, b) => a.rank - b.rank)
      .map((e) => e.id);
    expect(order).toEqual(['el_outer', 'el_inner', 'el_loose', 'el_task']);
    const sorted = order.map((id) => scene.elements.get(id as ElementId)!);
    const { below, above } = aroundConnectors(sorted);
    expect(below.map((e) => e.id)).toEqual(['el_outer', 'el_inner']);
    expect(above.map((e) => e.id)).toEqual(['el_loose', 'el_task']);
    // Hit testing follows the drawing: the topmost item at a point is an ordinary object.
    expect(scene.elementAt({ x: 10, y: 10 })?.id).toBe('el_task');
  });

  it('ranks again when an element changes container', () => {
    const { store, scene, create } = setup();
    const a = create(0, 0, undefined, BPMN.lane);
    const b = create(0, 300, undefined, BPMN.lane);
    const c = create(0, 600, undefined, BPMN.lane);
    const rank = (id: ElementId) => scene.elements.get(id)!.rank;
    expect(rank(b)).toBeLessThan(rank(c));
    // `b` is already above `a` in model order, so only its container changes, not its position.
    const pos = store.state.elements[b]!.pos;
    store.execute({ type: 'move', id: b, x: 0, y: 0, parent: a });
    expect(store.state.elements[b]!.pos).toBe(pos);
    // Nested one level deeper, it is now drawn above the top-level lane `c`.
    expect(rank(b)).toBeGreaterThan(rank(c));
  });

  it('picks the item drawn on top for a click: object, then connector, then container', () => {
    const { store, scene } = setup();
    const make = (
      cls: string,
      x: number,
      y: number,
      w: number,
      h: number,
      parent?: ElementId,
    ) => {
      const result = store.execute({
        type: 'createElement',
        class: cls as never,
        x,
        y,
        w,
        h,
        ...(parent ? { parent } : {}),
      });
      if (!result.ok) throw new Error('cancelled');
      return result.value as ElementId;
    };
    const outer = make(BPMN.lane, 0, 0, 800, 400);
    const lane = make(BPMN.lane, 20, 20, 700, 300, outer);
    const a = make(BPMN.task, 100, 100, 100, 50, lane);
    const b = make(BPMN.task, 500, 100, 100, 50, lane);
    const result = store.execute({
      type: 'createConnector',
      relation: BPMN.flow,
      from: a,
      to: b,
    });
    if (!result.ok) throw new Error('cancelled');
    const cn = result.value as string;
    // The line runs over the lane's fill at y = 125; the lane is under it but drawn below it.
    expect(scene.elementAt({ x: 350, y: 125 })?.id).toBe(lane);
    expect(scene.itemAt({ x: 350, y: 125 }, 4)).toMatchObject({
      kind: 'connector',
      id: cn,
    });
    // Near the line's ends the tasks are drawn above it and win.
    expect(scene.itemAt({ x: 195, y: 125 }, 4)?.id).toBe(a);
    // Empty lane space gives the inner lane, and outside it the outer one.
    expect(scene.itemAt({ x: 350, y: 250 }, 4)?.id).toBe(lane);
    expect(scene.itemAt({ x: 10, y: 10 }, 4)?.id).toBe(outer);
    expect(scene.itemAt({ x: 900, y: 900 }, 4)).toBeUndefined();
  });

  it('reports what changed', () => {
    const { store, scene, create } = setup();
    const changes: { ids: string[]; structural: boolean }[] = [];
    scene.onChange((c) =>
      changes.push({ ids: [...c.ids], structural: c.structural }),
    );
    const a = create(0, 0);
    store.execute({ type: 'move', id: a, x: 5, y: 5 });
    expect(changes[0]).toEqual({ ids: [a], structural: true });
    expect(changes[1]).toEqual({ ids: [a], structural: false });
  });
});
