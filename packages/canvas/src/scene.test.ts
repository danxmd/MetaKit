import { describe, expect, it } from 'vitest';
import type { ElementId, Model } from '@metakit-app/core';
import { Scene } from './scene';
import { BPMN, bpmnStore } from './testing';

function setup() {
  const { tool, store } = bpmnStore();
  const scene = new Scene(store.state as Model, tool);
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
  return { tool, store, scene, create };
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
    const { store, scene, create, tool } = setup();
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
    const fresh = new Scene(store.state as Model, tool);
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
