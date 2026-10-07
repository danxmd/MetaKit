import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createModelStore,
  type ElementId,
  type Model,
  type ModelCommand,
} from '@metakit-app/core';
import { BPMN, bpmnStore, emptyModel, loadTool } from '../testing';
import { align, distribute, type Placed } from './arrange';
import {
  copySelection,
  parseClipboard,
  planPaste,
  serializeClipboard,
} from './clipboard';
import { allowedRelations, canConnectAt, refusalReason } from './relations';
import { snapMove, snapValue } from './snap';

const rect = (x: number, y: number, w = 100, h = 50) => ({
  minX: x,
  minY: y,
  maxX: x + w,
  maxY: y + h,
});

describe('allowedRelations', () => {
  it('allows only relations whose ends fit, by inheritance', () => {
    const tool = loadTool('bpmn-lite');
    const type = Object.values(tool.modelTypes)[0]!;
    expect(
      allowedRelations(tool, type, 'cls_task', 'cls_gateway').map((r) => r.key),
    ).toEqual(['SequenceFlow']);
    expect(allowedRelations(tool, type, 'cls_lane', 'cls_task')).toEqual([]);
    expect(allowedRelations(tool, type, 'cls_task', 'cls_lane')).toEqual([]);
  });

  it('says which elements can start and end a connector', () => {
    const tool = loadTool('bpmn-lite');
    const type = Object.values(tool.modelTypes)[0]!;
    expect(canConnectAt(tool, type, 'cls_task')).toBe(true);
    expect(canConnectAt(tool, type, 'cls_lane')).toBe(false);
    expect(canConnectAt(tool, type, 'cls_gateway', { from: 'cls_task' })).toBe(
      true,
    );
    expect(canConnectAt(tool, type, 'cls_lane', { from: 'cls_task' })).toBe(
      false,
    );
    const flow = Object.values(tool.relations).find(
      (r) => r.key === 'SequenceFlow',
    )!;
    expect(canConnectAt(tool, type, 'cls_task', { relation: flow.id })).toBe(
      true,
    );
    expect(canConnectAt(tool, type, 'cls_lane', { relation: flow.id })).toBe(
      false,
    );
  });

  it('keeps ER relations apart', () => {
    const tool = loadTool('er-lite');
    const type = Object.values(tool.modelTypes)[0]!;
    const keys = (a: string, b: string) =>
      allowedRelations(tool, type, a as never, b as never).map((r) => r.key);
    expect(keys('cls_entity', 'cls_attribute')).toEqual(['Has']);
    expect(keys('cls_entity', 'cls_relationship')).toEqual(['Participates']);
    expect(keys('cls_attribute', 'cls_entity')).toEqual([]);
  });

  it('explains a refusal', () => {
    const tool = loadTool('bpmn-lite');
    expect(refusalReason(tool, 'cls_lane', 'cls_task')).toContain('Lane');
  });
});

describe('snapMove', () => {
  it('snaps an edge or centre to a nearby element and reports the guide', () => {
    const near = [rect(300, 0)];
    const r = snapMove(rect(297, 40), near, { grid: 0, threshold: 6 });
    expect(r.dx).toBe(3);
    expect(r.guides.x).toContain(300);
    expect(r.dy).toBe(0);
  });

  it('falls back to the grid, and leaves far things alone', () => {
    const r = snapMove(rect(23, 48), [], { grid: 10, threshold: 6 });
    expect(r).toEqual({ dx: -3, dy: 2, guides: { x: [], y: [] } });
    expect(snapMove(rect(23, 48), [], { grid: 0, threshold: 6 }).dx).toBe(0);
    expect(snapValue(14, 10)).toBe(10);
    expect(snapValue(14, 0)).toBe(14);
  });

  it('never moves further than the threshold when snapping to an element', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -500, max: 500 }),
        (x, y) => {
          const r = snapMove(rect(x, y), [rect(0, 0), rect(200, 120)], {
            grid: 0,
            threshold: 6,
          });
          expect(Math.abs(r.dx)).toBeLessThanOrEqual(6);
          expect(Math.abs(r.dy)).toBeLessThanOrEqual(6);
        },
      ),
    );
  });
});

describe('align and distribute', () => {
  const items: Placed[] = [
    { id: 'a', rect: rect(10, 0, 50, 20) },
    { id: 'b', rect: rect(100, 40, 80, 30) },
    { id: 'c', rect: rect(300, 90, 20, 20) },
  ];

  it('aligns left, right and centres', () => {
    expect(align(items, 'left').map((m) => m.x)).toEqual([10, 10]);
    const right = align(items, 'right');
    expect(right.find((m) => m.id === 'a')!.x).toBe(270);
    const centre = align(items, 'centre');
    expect(centre.find((m) => m.id === 'c')!.x).toBe(155);
    expect(align(items, 'top').every((m) => m.y === 0)).toBe(true);
    expect(align(items, 'bottom').find((m) => m.id === 'a')!.y).toBe(90);
    expect(align(items, 'middle').find((m) => m.id === 'a')!.y).toBe(45);
  });

  it('does nothing for one item, and does not move items already in place', () => {
    expect(align([items[0]!], 'left')).toEqual([]);
    expect(align([items[0]!, { id: 'z', rect: rect(10, 90) }], 'left')).toEqual(
      [],
    );
  });

  it('distributes with equal gaps and keeps the outer items', () => {
    const moves = distribute(items, 'horizontal');
    expect(moves).toEqual([{ id: 'b', x: 140, y: 40 }]);
    expect(distribute(items.slice(0, 2), 'horizontal')).toEqual([]);
  });

  it('gives equal gaps for any positions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.integer({ min: 0, max: 1000 }),
            fc.integer({ min: 10, max: 120 }),
          ),
          {
            minLength: 3,
            maxLength: 8,
          },
        ),
        (spec) => {
          const placed = spec.map(([x, w], i) => ({
            id: `i${i}`,
            rect: rect(x, 0, w, 10),
          }));
          const span =
            Math.max(...placed.map((p) => p.rect.maxX)) -
            Math.min(...placed.map((p) => p.rect.minX));
          const sizes = placed.reduce(
            (n, p) => n + (p.rect.maxX - p.rect.minX),
            0,
          );
          // With less room than the items need there is no gap to equalise.
          fc.pre(span > sizes);
          const sortedFirst = [...placed].sort(
            (a, b) => a.rect.minX - b.rect.minX,
          );
          const lastHi = sortedFirst.at(-1)!.rect.maxX;
          fc.pre(lastHi === Math.max(...placed.map((p) => p.rect.maxX)));
          const moves = new Map(
            distribute(placed, 'horizontal').map((m) => [m.id, m.x]),
          );
          const after = placed
            .map((p) => ({
              lo: moves.get(p.id) ?? p.rect.minX,
              w: p.rect.maxX - p.rect.minX,
            }))
            .sort((a, b) => a.lo - b.lo);
          const gaps = after
            .slice(1)
            .map((p, i) => p.lo - (after[i]!.lo + after[i]!.w));
          for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 6);
        },
      ),
    );
  });
});

describe('clipboard', () => {
  function build() {
    const { tool, store } = bpmnStore();
    const run = (c: ModelCommand) =>
      (store.execute(c) as unknown as { value: never }).value;
    const a = run({
      type: 'createElement',
      class: BPMN.task,
      x: 0,
      y: 0,
      attrs: { [BPMN.name]: 'A' },
    }) as ElementId;
    const b = run({
      type: 'createElement',
      class: BPMN.gateway,
      x: 300,
      y: 0,
    }) as ElementId;
    const c = run({
      type: 'createElement',
      class: BPMN.end,
      x: 600,
      y: 0,
    }) as ElementId;
    run({
      type: 'createConnector',
      relation: BPMN.flow,
      from: a,
      to: b,
      bends: [{ x: 200, y: 100 }],
    });
    run({ type: 'createConnector', relation: BPMN.flow, from: b, to: c });
    return { tool, store, a, b, c };
  }

  it('copies the selection and the connectors between selected elements only', () => {
    const { tool, store, a, b } = build();
    const data = copySelection(tool, store.state as Model, [a, b]);
    expect(data.elements).toHaveLength(2);
    expect(data.connectors).toHaveLength(1);
    expect(data.elements[0]!.attrs).toMatchObject({ Name: 'A' });
    expect(parseClipboard(serializeClipboard(data))).toEqual(data);
    expect(parseClipboard('hello')).toBeNull();
    expect(parseClipboard('{"kind":"other"}')).toBeNull();
  });

  it('pastes into the same model with new ids, an offset and the values', () => {
    const { tool, store, a, b } = build();
    const data = copySelection(tool, store.state as Model, [a, b]);
    const type = tool.modelTypes[(store.state as Model).manifest.modelType]!;
    const plan = planPaste(tool, type, data, { x: 20, y: 20 });
    expect(plan.skipped).toEqual({ elements: 0, connectors: 0 });
    const result = store.execute({ type: 'batch', commands: plan.commands });
    expect(result.ok).toBe(true);
    const model = store.state as Model;
    expect(Object.keys(model.elements)).toHaveLength(5);
    const pasted = model.elements[plan.elements[0]!]!;
    expect(pasted.x).toBe(20);
    expect(pasted.attrs[BPMN.name]).toBe('A');
    const connector = model.connectors[plan.connectors[0]!]!;
    expect(connector.from).toBe(plan.elements[0]);
    expect(connector.bends).toEqual([{ x: 220, y: 120 }]);
    // One undo removes the whole paste.
    store.undo();
    expect(Object.keys((store.state as Model).elements)).toHaveLength(3);
  });

  it('pastes into a model of another tool library by key, and skips what does not fit', () => {
    const { tool, store, a, b } = build();
    const data = copySelection(tool, store.state as Model, [a, b]);
    const er = loadTool('er-lite');
    const erModel = emptyModel(er);
    const erStore = createModelStore(erModel, { tool: er });
    const type = er.modelTypes[erModel.manifest.modelType]!;
    const plan = planPaste(er, type, data, { x: 0, y: 0 });
    expect(plan.skipped.elements).toBe(2);
    expect(plan.skipped.connectors).toBe(1);
    expect(plan.commands).toEqual([]);
    expect(erStore.execute({ type: 'batch', commands: plan.commands }).ok).toBe(
      true,
    );
  });

  it('matches classes by key when the ids differ', () => {
    const { tool, store, a } = build();
    const data = copySelection(tool, store.state as Model, [a]);
    data.tool = 'tool_other0000';
    data.elements[0]!.class = 'cls_unknown00';
    const type = tool.modelTypes[(store.state as Model).manifest.modelType]!;
    const plan = planPaste(tool, type, data, { x: 0, y: 0 });
    expect(plan.commands).toHaveLength(1);
  });
});
