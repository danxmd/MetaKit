import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ClassId, ElementId } from '../ids';
import type { ToolLibrary } from '../meta/types';
import {
  SAMPLE,
  clone,
  emptySampleModel,
  sampleTool,
} from '../testing/sample-tool';
import { validateModel } from '../validation/validate';
import { createModelStore, type ModelStore } from './commands';
import {
  FIT_PADDING,
  ancestorsOf,
  containerAccepts,
  containerAt,
  descendantsOf,
  outermostOf,
  parentChainLoops,
} from './containers';
import type { Model } from './types';

const BOX = 'cls_box' as ClassId;

/** The sample tool plus a plain container class, with the lane limited to tasks and gateways. */
function containerTool(): ToolLibrary {
  const tool = clone(sampleTool());
  tool.classes[BOX] = {
    id: BOX,
    key: 'Box',
    kind: 'container',
    labels: { en: 'Box' },
    attributes: [],
  };
  const mt = tool.modelTypes[SAMPLE.process]!;
  mt.classes.push(BOX);
  mt.containers = { [SAMPLE.lane]: [SAMPLE.task, SAMPLE.gateway] };
  return tool;
}

const tool = containerTool();
const mt = SAMPLE.process;

function create(
  store: ModelStore,
  cls: ClassId,
  x: number,
  y: number,
  w?: number,
  h?: number,
  parent?: ElementId,
): ElementId {
  const r = store.execute({
    type: 'createElement',
    class: cls,
    x,
    y,
    ...(w ? { w } : {}),
    ...(h ? { h } : {}),
    ...(parent ? { parent } : {}),
  });
  if (!r.ok) throw new Error(r.reason);
  return r.value as ElementId;
}
const fresh = () => createModelStore(emptySampleModel(), { tool });
const el = (store: ModelStore, id: ElementId) => store.state.elements[id]!;

describe('containerAccepts', () => {
  it('accepts anything when the class has no rule, and subclasses of listed classes', () => {
    expect(containerAccepts(tool, mt, BOX, SAMPLE.end)).toBe(true);
    expect(containerAccepts(tool, mt, SAMPLE.lane, SAMPLE.task)).toBe(true);
    expect(containerAccepts(tool, mt, SAMPLE.lane, SAMPLE.start)).toBe(false);
    const t = clone(tool);
    t.modelTypes[mt]!.containers = { [SAMPLE.lane]: [SAMPLE.flowNode] };
    expect(containerAccepts(t, mt, SAMPLE.lane, SAMPLE.end)).toBe(true);
  });

  it('inherits the rule of the nearest ancestor class that has one', () => {
    const t = clone(tool);
    const sub = 'cls_sublane' as ClassId;
    t.classes[sub] = {
      id: sub,
      key: 'SubLane',
      kind: 'swimlane',
      labels: { en: 'Sub' },
      extends: SAMPLE.lane,
      attributes: [],
    };
    t.modelTypes[mt]!.classes.push(sub);
    expect(containerAccepts(t, mt, sub, SAMPLE.start)).toBe(false);
    expect(containerAccepts(t, mt, sub, SAMPLE.task)).toBe(true);
  });
});

describe('containerAt', () => {
  it('finds the deepest container that holds the point and accepts the class', () => {
    const s = fresh();
    const box = create(s, BOX, 0, 0, 600, 400);
    const lane = create(s, SAMPLE.lane, 50, 50, 300, 200, box);
    const model = s.state;
    const inLane = { x: 100, y: 100 };
    expect(containerAt(model, tool, mt, inLane, [], SAMPLE.task)).toBe(lane);
    // The lane does not accept a start event, so the box is the target.
    expect(containerAt(model, tool, mt, inLane, [], SAMPLE.start)).toBe(box);
    expect(
      containerAt(model, tool, mt, { x: 500, y: 300 }, [], SAMPLE.task),
    ).toBe(box);
    expect(
      containerAt(model, tool, mt, { x: 900, y: 900 }, [], SAMPLE.task),
    ).toBe(null);
  });

  it('never returns a plain node, the element itself, or something inside it', () => {
    const s = fresh();
    const box = create(s, BOX, 0, 0, 600, 400);
    const inner = create(s, BOX, 10, 10, 200, 200, box);
    const task = create(s, SAMPLE.task, 20, 20, 100, 50, inner);
    const p = { x: 50, y: 50 };
    expect(containerAt(s.state, tool, mt, p, [], SAMPLE.task)).toBe(inner);
    expect(containerAt(s.state, tool, mt, p, [task], SAMPLE.task)).toBe(inner);
    expect(containerAt(s.state, tool, mt, p, [inner], BOX)).toBe(box);
    expect(containerAt(s.state, tool, mt, p, [box], BOX)).toBe(null);
  });

  it('prefers the container drawn on top among equals', () => {
    const s = fresh();
    create(s, BOX, 0, 0, 100, 100);
    const top = create(s, BOX, 0, 0, 100, 100);
    expect(
      containerAt(s.state, tool, mt, { x: 5, y: 5 }, [], SAMPLE.task),
    ).toBe(top);
  });
});

describe('index helpers', () => {
  it('lists descendants once, outermost ids, ancestors and loops', () => {
    const s = fresh();
    const a = create(s, BOX, 0, 0, 500, 500);
    const b = create(s, BOX, 10, 10, 200, 200, a);
    const c = create(s, SAMPLE.task, 20, 20, 50, 50, b);
    expect(descendantsOf(s.state, a).sort()).toEqual([b, c].sort());
    expect(ancestorsOf(s.state, c)).toEqual([b, a]);
    expect(outermostOf(s.state, [a, b, c])).toEqual([a]);
    expect(outermostOf(s.state, [b, c])).toEqual([b]);
    const looped = clone(s.state) as Model;
    (looped.elements[a] as { parent?: ElementId }).parent = c;
    expect(parentChainLoops(looped, a)).toBe(true);
    expect(parentChainLoops(s.state, a)).toBe(false);
    expect(descendantsOf(looped, a).sort()).toEqual([b, c].sort());
  });
});

describe('move with containers', () => {
  it('moves all descendants by the same offset as one undo step', () => {
    const s = fresh();
    const box = create(s, BOX, 100, 100, 500, 400);
    const inner = create(s, BOX, 120, 120, 200, 200, box);
    const task = create(s, SAMPLE.task, 130, 130, 100, 50, inner);
    const outside = create(s, SAMPLE.task, 900, 900);
    const before = s.state;
    const steps = s.history().length;
    s.execute({ type: 'move', id: box, x: 150, y: 70 });
    expect(el(s, box)).toMatchObject({ x: 150, y: 70 });
    expect(el(s, inner)).toMatchObject({ x: 170, y: 90 });
    expect(el(s, task)).toMatchObject({ x: 180, y: 100 });
    expect(el(s, outside)).toMatchObject({ x: 900, y: 900 });
    expect(s.history().length).toBe(steps + 1);
    s.undo();
    expect(s.state).toEqual(before);
  });

  it('does not move descendants twice when a container and its child are both moved first-container-last', () => {
    const s = fresh();
    const lane = create(s, BOX, 0, 0, 500, 400);
    const task = create(s, SAMPLE.task, 10, 10, 100, 50, lane);
    // The editor sends only the outermost element; the container alone carries the child.
    const roots = outermostOf(s.state, [lane, task]);
    s.execute({
      type: 'batch',
      commands: roots.map((id) => ({
        type: 'move' as const,
        id,
        x: 40,
        y: 40,
      })),
    });
    expect(el(s, task)).toMatchObject({ x: 50, y: 50 });
  });

  it('on drop sets the parent from the centre and clears it outside every container', () => {
    const s = fresh();
    const lane = create(s, SAMPLE.lane, 0, 0, 400, 200);
    const task = create(s, SAMPLE.task, 600, 600, 100, 50);
    const before = s.state;
    s.execute({ type: 'move', id: task, x: 100, y: 50, drop: true });
    expect(el(s, task).parent).toBe(lane);
    s.undo();
    expect(s.state).toEqual(before);
    s.execute({ type: 'move', id: task, x: 100, y: 50, drop: true });
    s.execute({ type: 'move', id: task, x: 700, y: 700, drop: true });
    expect('parent' in el(s, task)).toBe(false);
  });

  it('keeps the container when dropped without drop, and an explicit parent wins over drop', () => {
    const s = fresh();
    const lane = create(s, SAMPLE.lane, 0, 0, 400, 200);
    const box = create(s, BOX, 0, 300, 400, 200);
    const task = create(s, SAMPLE.task, 100, 50, 100, 50, lane);
    s.execute({ type: 'move', id: task, x: 100, y: 350 });
    expect(el(s, task).parent).toBe(lane);
    s.execute({
      type: 'move',
      id: task,
      x: 100,
      y: 350,
      drop: true,
      parent: lane,
    });
    expect(el(s, task).parent).toBe(lane);
    s.execute({ type: 'move', id: task, x: 100, y: 350, drop: true });
    expect(el(s, task).parent).toBe(box);
  });

  it('leaves a class the container does not accept at the top level', () => {
    const s = fresh();
    create(s, SAMPLE.lane, 0, 0, 400, 200);
    const start = create(s, SAMPLE.start, 600, 600, 40, 40);
    s.execute({ type: 'move', id: start, x: 100, y: 50, drop: true });
    expect('parent' in el(s, start)).toBe(false);
  });

  it('draws a dropped element and its contents above the new container', () => {
    const s = fresh();
    const small = create(s, BOX, 600, 0, 100, 100);
    const smallChild = create(s, SAMPLE.task, 610, 10, 40, 40, small);
    const big = create(s, BOX, 0, 0, 500, 500); // created later, so drawn above
    s.execute({ type: 'move', id: small, x: 100, y: 100, drop: true });
    expect(el(s, small).parent).toBe(big);
    expect(el(s, small).pos > el(s, big).pos).toBe(true);
    expect(el(s, smallChild).pos > el(s, small).pos).toBe(true);
  });

  it('refuses to drop a container into its own contents', () => {
    const s = fresh();
    const box = create(s, BOX, 0, 0, 500, 500);
    const inner = create(s, BOX, 10, 10, 100, 100, box);
    s.execute({ type: 'move', id: box, x: 0, y: 0, drop: true });
    expect('parent' in el(s, box)).toBe(false);
    expect(el(s, inner).parent).toBe(box);
  });
});

describe('swimlanes fit their children', () => {
  it('grows to the right when a child is dropped beyond the edge, as one undo step', () => {
    const s = fresh();
    const lane = create(s, SAMPLE.lane, 0, 0, 300, 200);
    const task = create(s, SAMPLE.task, 700, 700, 100, 50);
    const before = s.state;
    s.execute({ type: 'move', id: task, x: 250, y: 50, drop: true });
    expect(el(s, task).parent).toBe(lane);
    expect(el(s, lane)).toMatchObject({
      x: 0,
      y: 0,
      w: 350 + FIT_PADDING,
      h: 200,
    });
    s.undo();
    expect(s.state).toEqual(before);
  });

  it('grows to the left and top, but never shrinks', () => {
    const s = fresh();
    const lane = create(s, SAMPLE.lane, 100, 100, 300, 200);
    const task = create(s, SAMPLE.task, 150, 150, 100, 50, lane);
    s.execute({ type: 'move', id: task, x: 60, y: 60 });
    expect(el(s, lane)).toMatchObject({ x: 50, y: 50, w: 350, h: 250 });
    s.execute({ type: 'move', id: task, x: 200, y: 150 });
    expect(el(s, lane)).toMatchObject({ x: 50, y: 50, w: 350, h: 250 });
  });

  it('grows on create and on resize of a child, and on explicit fitContainer', () => {
    const s = fresh();
    const lane = create(s, SAMPLE.lane, 0, 0, 300, 200);
    const task = create(s, SAMPLE.task, 280, 10, 100, 50, lane);
    expect(el(s, lane).w).toBe(390);
    s.execute({ type: 'resize', id: task, w: 200, h: 300 });
    expect(el(s, lane)).toMatchObject({ w: 490, h: 320 });
    s.execute({ type: 'fitContainer', id: lane, padding: 0 });
    expect(el(s, lane)).toMatchObject({ w: 490, h: 320 });
  });

  it('does not grow a plain container, and fitContainer refuses one', () => {
    const s = fresh();
    const box = create(s, BOX, 0, 0, 100, 100);
    create(s, SAMPLE.task, 80, 80, 100, 50, box);
    expect(el(s, box)).toMatchObject({ w: 100, h: 100 });
    expect(() => s.execute({ type: 'fitContainer', id: box })).toThrow(
      /swimlane/,
    );
  });

  it('grows the swimlane around a lane that grew', () => {
    const s = fresh();
    const outer = create(s, SAMPLE.lane, 0, 0, 300, 200);
    const inner = create(s, SAMPLE.lane, 20, 20, 100, 100, outer);
    create(s, SAMPLE.task, 100, 50, 100, 50, inner);
    expect(el(s, inner).w).toBe(190);
    expect(el(s, outer).w).toBe(300);
    create(s, SAMPLE.task, 100, 50, 300, 50, inner);
    expect(el(s, outer).w).toBe(420);
  });
});

describe('validation of containers', () => {
  const issue = (model: Model, code: string) =>
    validateModel(tool, model).filter((i) => i.code === code);

  it('reports a parent that is not a container, not accepted, or in a loop', () => {
    const s = fresh();
    const lane = create(s, SAMPLE.lane, 0, 0, 400, 200);
    const task = create(s, SAMPLE.task, 10, 10, 100, 50, lane);
    const start = create(s, SAMPLE.start, 10, 10, 40, 40, lane);
    const child = create(s, SAMPLE.task, 10, 10, 20, 20, task);
    expect(issue(s.state, 'parent-not-accepted').map((i) => i.id)).toEqual([
      start,
    ]);
    expect(issue(s.state, 'parent-not-container').map((i) => i.id)).toEqual([
      child,
    ]);
    const looped = clone(s.state) as Model;
    (looped.elements[lane] as { parent?: ElementId }).parent = task;
    // Everything that leads into the loop is reported, the two members first of all.
    expect(issue(looped, 'parent-loop').map((i) => i.id)).toEqual(
      expect.arrayContaining([lane, task]),
    );
    expect(issue(s.state, 'parent-loop')).toEqual([]);
  });

  it('accepts a model whose containers follow the rules', () => {
    const s = fresh();
    const lane = create(s, SAMPLE.lane, 0, 0, 400, 200);
    create(s, SAMPLE.task, 10, 10, 100, 50, lane);
    expect(issue(s.state, 'parent-not-accepted')).toEqual([]);
    expect(issue(s.state, 'parent-not-container')).toEqual([]);
  });
});

describe('properties', () => {
  type Op =
    | { k: 'move'; i: number; x: number; y: number; drop: boolean }
    | { k: 'resize'; i: number; w: number; h: number }
    | { k: 'delete'; i: number }
    | { k: 'undo' }
    | { k: 'redo' };
  const op: fc.Arbitrary<Op> = fc.oneof(
    fc.record({
      k: fc.constant('move' as const),
      i: fc.nat(7),
      x: fc.integer({ min: -100, max: 700 }),
      y: fc.integer({ min: -100, max: 500 }),
      drop: fc.boolean(),
    }),
    fc.record({
      k: fc.constant('resize' as const),
      i: fc.nat(7),
      w: fc.integer({ min: 20, max: 400 }),
      h: fc.integer({ min: 20, max: 400 }),
    }),
    fc.record({ k: fc.constant('delete' as const), i: fc.nat(7) }),
    fc.constant({ k: 'undo' as const }),
    fc.constant({ k: 'redo' as const }),
  );

  const classes = [
    BOX,
    SAMPLE.lane,
    BOX,
    SAMPLE.task,
    SAMPLE.gateway,
    SAMPLE.start,
    SAMPLE.task,
    SAMPLE.lane,
  ];

  it('keeps the parent graph acyclic and undo exact through random drops', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
        const s = fresh();
        classes.forEach((cls, n) =>
          create(s, cls, (n % 4) * 150, Math.floor(n / 4) * 150, 140, 140),
        );
        const ids = () => Object.keys(s.state.elements).sort() as ElementId[];
        for (const o of ops) {
          const list = ids();
          const id = list[('i' in o ? o.i : 0) % Math.max(list.length, 1)];
          if (o.k === 'undo') s.undo();
          else if (o.k === 'redo') s.redo();
          else if (id) {
            const before = s.state;
            const r =
              o.k === 'move'
                ? s.execute({ type: 'move', id, x: o.x, y: o.y, drop: o.drop })
                : o.k === 'resize'
                  ? s.execute({ type: 'resize', id, w: o.w, h: o.h })
                  : s.execute({ type: 'delete', id });
            if (r.ok) {
              s.undo();
              expect(s.state).toEqual(before);
              s.redo();
            }
          }
          for (const e of Object.values(s.state.elements)) {
            expect(parentChainLoops(s.state, e.id)).toBe(false);
            if (e.parent) {
              expect(s.state.elements[e.parent]).toBeDefined();
              expect(e.pos > s.state.elements[e.parent]!.pos).toBe(true);
            }
          }
        }
      }),
      { numRuns: 60 },
    );
  });
});
