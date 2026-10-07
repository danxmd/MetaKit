import { describe, expect, it } from 'vitest';
import type { ConnectorId, ElementId, Model } from '@metakit-app/core';
import { BPMN, bpmnStore } from '../testing';
import { InProcessEngine } from './in-process';
import { LayoutService } from './layout-service';

const service = new LayoutService({ engine: new InProcessEngine() });

function build(n: number, links: [number, number][]) {
  const { store } = bpmnStore();
  const ids: ElementId[] = [];
  // Everything starts piled up, so any spread comes from the layout.
  for (let i = 0; i < n; i++) {
    const r = store.execute({
      type: 'createElement',
      class: BPMN.task,
      x: 5,
      y: 5,
    });
    if (!r.ok) throw new Error(r.reason);
    ids.push(r.value as ElementId);
  }
  const cns: ConnectorId[] = [];
  for (const [a, b] of links) {
    const r = store.execute({
      type: 'createConnector',
      relation: BPMN.flow,
      from: ids[a]!,
      to: ids[b]!,
    });
    if (!r.ok) throw new Error(r.reason);
    cns.push(r.value as ConnectorId);
  }
  return { store, ids, cns };
}

const overlap = (m: Model, a: ElementId, b: ElementId) => {
  const p = m.elements[a]!;
  const q = m.elements[b]!;
  return (
    p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
  );
};

describe('auto-layout', () => {
  it('lays a 20-node chain left to right without overlaps', async () => {
    const links = Array.from(
      { length: 19 },
      (_, i) => [i, i + 1] as [number, number],
    );
    const { store, ids } = build(20, links);
    const result = await service.layout(store.state as Model);
    store.execute({ type: 'applyLayout', ...result });
    const m = store.state as Model;
    for (let i = 1; i < ids.length; i++)
      expect(m.elements[ids[i]!]!.x).toBeGreaterThan(
        m.elements[ids[i - 1]!]!.x,
      );
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        expect(overlap(m, ids[i]!, ids[j]!)).toBe(false);
  });

  it('lays out downwards when asked', async () => {
    const { store, ids } = build(3, [
      [0, 1],
      [1, 2],
    ]);
    const result = await service.layout(store.state as Model, {
      direction: 'down',
    });
    store.execute({ type: 'applyLayout', ...result });
    const m = store.state as Model;
    expect(m.elements[ids[1]!]!.y).toBeGreaterThan(m.elements[ids[0]!]!.y);
    expect(m.elements[ids[2]!]!.y).toBeGreaterThan(m.elements[ids[1]!]!.y);
  });

  it('routes connectors with orthogonal bends', async () => {
    // A diamond forces at least one connector to turn.
    const { store, cns } = build(4, [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
    ]);
    const result = await service.layout(store.state as Model);
    expect(result.bends).toHaveLength(4);
    const turning = result.bends.filter((b) => b.bends.length > 0);
    expect(turning.length).toBeGreaterThan(0);
    store.execute({ type: 'applyLayout', ...result });
    const m = store.state as Model;
    for (const id of cns) {
      const points = m.connectors[id]!.bends;
      const a = m.elements[m.connectors[id]!.from]!;
      const path = [{ x: a.x + a.w, y: a.y + a.h / 2 }, ...points];
      // Every segment between bends is horizontal or vertical.
      for (let i = 1; i < points.length; i++) {
        const p = path[i]!;
        const q = path[i + 1]!;
        expect(p.x === q.x || p.y === q.y).toBe(true);
      }
    }
  });

  it('copes with a cycle', async () => {
    const { store, ids } = build(3, [
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
    const result = await service.layout(store.state as Model);
    expect(result.moves).toHaveLength(3);
    store.execute({ type: 'applyLayout', ...result });
    const m = store.state as Model;
    expect(overlap(m, ids[0]!, ids[1]!)).toBe(false);
    expect(overlap(m, ids[1]!, ids[2]!)).toBe(false);
    expect(overlap(m, ids[0]!, ids[2]!)).toBe(false);
  });

  it('keeps children inside their container and sizes the container to fit', async () => {
    const { store, ids } = build(4, [
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
    const r = store.execute({
      type: 'createElement',
      class: BPMN.lane,
      x: 0,
      y: 0,
      w: 50,
      h: 50,
    });
    if (!r.ok) throw new Error(r.reason);
    const lane = r.value as ElementId;
    store.execute({ type: 'move', id: ids[1]!, x: 5, y: 5, parent: lane });
    store.execute({ type: 'move', id: ids[2]!, x: 5, y: 5, parent: lane });
    const result = await service.layout(store.state as Model);
    expect(result.resizes.map((x) => x.id)).toEqual([lane]);
    store.execute({ type: 'applyLayout', ...result });
    const m = store.state as Model;
    const l = m.elements[lane]!;
    for (const id of [ids[1]!, ids[2]!]) {
      const e = m.elements[id]!;
      expect(e.x).toBeGreaterThanOrEqual(l.x);
      expect(e.y).toBeGreaterThanOrEqual(l.y);
      expect(e.x + e.w).toBeLessThanOrEqual(l.x + l.w);
      expect(e.y + e.h).toBeLessThanOrEqual(l.y + l.h);
    }
    // The children sit below the lane's title bar.
    expect(m.elements[ids[1]!]!.y).toBeGreaterThan(l.y);
    // Outside shapes do not overlap the container.
    expect(overlap(m, ids[0]!, lane)).toBe(false);
    expect(overlap(m, ids[3]!, lane)).toBe(false);
  });

  it('undoes in one step', async () => {
    const { store, ids } = build(5, [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
    const before = store.state as Model;
    const steps = store.history().length;
    const result = await service.layout(before);
    store.execute({ type: 'applyLayout', ...result });
    expect(store.history().length).toBe(steps + 1);
    store.undo();
    expect(store.state.elements[ids[3]!]).toMatchObject({ x: 5, y: 5 });
  });

  it('with selection only, leaves the others in place', async () => {
    const { store, ids } = build(4, [
      [0, 1],
      [2, 3],
    ]);
    store.execute({ type: 'move', id: ids[0]!, x: 400, y: 300 });
    store.execute({ type: 'move', id: ids[1]!, x: 400, y: 300 });
    const result = await service.layout(store.state as Model, {
      selectionOnly: true,
      selection: [ids[2]!, ids[3]!],
    });
    expect(result.moves.map((m) => m.id).sort()).toEqual(
      [ids[2]!, ids[3]!].sort(),
    );
    expect(result.bends.map((b) => b.id)).toHaveLength(1);
    // The group keeps its top-left corner.
    const first = result.moves.find((m) => m.id === ids[2])!;
    expect(first).toMatchObject({ x: 5, y: 5 });
  });

  it('does not move fixed elements', async () => {
    const { store, ids } = build(3, [
      [0, 1],
      [1, 2],
    ]);
    const result = await service.layout(store.state as Model, {
      keepFixed: [ids[1]!],
    });
    expect(result.moves.map((m) => m.id)).not.toContain(ids[1]);
  });

  it('returns nothing for an empty model', async () => {
    const { store } = bpmnStore();
    expect(await service.layout(store.state as Model)).toEqual({
      moves: [],
      resizes: [],
      bends: [],
    });
  });

  it('stops when cancelled', async () => {
    const { store } = build(3, [[0, 1]]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.layout(store.state as Model, { signal: controller.signal }),
    ).rejects.toMatchObject({ reason: 'cancelled' });
  });
});
