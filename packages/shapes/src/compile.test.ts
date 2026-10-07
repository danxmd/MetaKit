import type {
  NodeShape,
  RelationShape,
  ShapeDef,
  ShapeId,
} from '@metakit-app/core';
import type { Scope, Value } from '@metakit-app/formula';
import { describe, expect, it } from 'vitest';
import { CompileCache } from './cache';
import { compileNode } from './compile';
import { resolveDim, wrapText } from './dim';
import { compileRelation } from './relation';
import { STARTER_SHAPES, starterFor } from './starter';

const scopeOf = (values: Record<string, Value>): Scope => ({
  get: (n) => (Object.hasOwn(values, n) ? values[n] : undefined),
});

/** The task shape from the plan, as written there. */
export const PLAN_TASK: NodeShape = {
  id: 'shp_task',
  kind: 'node',
  size: {
    width: 140,
    height: 70,
    resizable: true,
    minWidth: 80,
    minHeight: 40,
  },
  outline: 'rect',
  let: {
    accent:
      "= Priority == 'High' ? '#D93025' : Priority == 'Medium' ? '#F29900' : '#5F6368'",
  },
  parts: [
    {
      type: 'rect',
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      radius: 10,
      fill: '#FFFFFF',
      stroke: '= accent',
      strokeWidth: 2,
    },
    {
      type: 'rect',
      x: 0,
      y: 0,
      width: 6,
      height: '100%',
      radius: 3,
      fill: '= accent',
    },
    {
      type: 'text',
      x: 14,
      y: 8,
      width: '100% - 28',
      height: '100% - 26',
      text: '= Name',
      wrap: true,
      fit: 'shrink',
      align: 'center',
      valign: 'middle',
      font: { size: 13, weight: 600 },
    },
    {
      type: 'image',
      src: 'assets/gear.3fa2c1.svg',
      x: '100% - 22',
      y: 4,
      width: 18,
      height: 18,
      visible: "= TaskType == 'Service'",
    },
    {
      type: 'image',
      src: 'assets/person.9b81d0.svg',
      x: 6,
      y: '100% - 20',
      width: 14,
      height: 14,
      visible: '= Owner != null',
      tooltip: "= 'Owner: ' + Owner.Name",
      onClick: '= open(Owner)',
    },
    {
      type: 'text',
      x: 14,
      y: '100% - 18',
      width: '100% - 28',
      height: 14,
      text: "= Effort ? Effort + ' h' : ''",
      align: 'right',
      font: { size: 10 },
      fill: '#5F6368',
    },
  ],
} as NodeShape;

const PLAN_FLOW: RelationShape = {
  id: 'shp_sequence_flow',
  kind: 'relation',
  line: {
    stroke: '#202124',
    strokeWidth: 1.5,
    dash: '= Condition ? [6, 4] : []',
    routing: 'orthogonal',
    corners: 6,
  },
  startMarker: { type: 'none' },
  endMarker: { type: 'arrow', fill: '#202124' },
  labels: [
    {
      at: 'middle',
      offset: { x: 0, y: -10 },
      text: '= Condition',
      font: { size: 11 },
      background: '#FFFFFF',
    },
  ],
};

const taskScope = (over: Record<string, Value> = {}) =>
  scopeOf({
    Name: 'Check order',
    Priority: 'High',
    TaskType: 'Manual',
    Owner: null,
    Effort: 3,
    ...over,
  });

const rects = (ops: ReturnType<typeof compileNode>['ops']) =>
  ops.filter((o) => o.op === 'rect') as Extract<
    ReturnType<typeof compileNode>['ops'][number],
    { op: 'rect' }
  >[];

describe('dimensions', () => {
  it('resolves numbers, percentages and sums', () => {
    expect(resolveDim(12, 200)).toBe(12);
    expect(resolveDim('50%', 200)).toBe(100);
    expect(resolveDim('100% - 22', 140)).toBe(118);
    expect(resolveDim('10% + 4 - 2', 100)).toBe(12);
    expect(resolveDim('12', 100)).toBe(12);
    expect(resolveDim('wide', 100)).toBeNull();
    expect(resolveDim('50% *', 100)).toBeNull();
  });

  it('wraps text and cuts with an ellipsis', () => {
    expect(wrapText('one two three', 40, 12, 5)).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(wrapText('a b c d e f g h', 10, 12, 2).at(-1)!.endsWith('…')).toBe(
      true,
    );
  });
});

describe('the plan task shape', () => {
  it.each([
    [140, 70],
    [200, 100],
    [90, 44],
  ])('compiles at %i x %i and stretches', (w, h) => {
    const c = compileNode(PLAN_TASK, { w, h, scope: taskScope() });
    expect(c.messages).toEqual([]);
    const [frame, accent] = rects(c.ops);
    expect(frame!.box).toEqual({ x: 0, y: 0, w, h });
    expect(frame!.style.stroke).toBe('#D93025');
    expect(accent!.box).toEqual({ x: 0, y: 0, w: 6, h });
    const name = c.ops.find((o) => o.op === 'text')!;
    expect(name.op === 'text' && name.box).toEqual({
      x: 14,
      y: 8,
      w: w - 28,
      h: h - 26,
    });
    const effort = c.ops.filter((o) => o.op === 'text')[1]!;
    expect(effort.op === 'text' && effort.lines[0]!.text).toBe('3 h');
    expect(effort.op === 'text' && effort.box.y).toBe(h - 18);
  });

  it('follows Priority and shows the icons by condition', () => {
    const high = compileNode(PLAN_TASK, { w: 140, h: 70, scope: taskScope() });
    const low = compileNode(PLAN_TASK, {
      w: 140,
      h: 70,
      scope: taskScope({ Priority: 'Low', TaskType: 'Service' }),
    });
    expect(rects(low.ops)[0]!.style.stroke).toBe('#5F6368');
    expect(rects(high.ops)[0]!.style.stroke).toBe('#D93025');
    expect(high.ops.filter((o) => o.op === 'image')).toHaveLength(0);
    const gear = low.ops.filter((o) => o.op === 'image');
    expect(gear).toHaveLength(1);
    expect(gear[0]!.op === 'image' && gear[0]!.box).toEqual({
      x: 118,
      y: 4,
      w: 18,
      h: 18,
    });
    expect(low.reads).toEqual(
      expect.arrayContaining(['Priority', 'TaskType', 'Name']),
    );
  });

  it('gives the owner icon a tooltip and a click action', () => {
    const scope: Scope = {
      get: (n) => taskScope({ Owner: 'el_anna' }).get(n),
      member: (v, key) =>
        v === 'el_anna' && key === 'Name' ? 'Anna' : undefined,
    };
    const c = compileNode(PLAN_TASK, { w: 140, h: 70, scope });
    expect(c.hotspots).toHaveLength(1);
    expect(c.hotspots[0]!.tooltip).toBe('Owner: Anna');
    expect(c.hotspots[0]!.click).toEqual({ action: 'open', target: 'el_anna' });
    expect(c.hotspots[0]!.box).toEqual({ x: 6, y: 50, w: 14, h: 14 });
  });

  it('uses the outline given', () => {
    expect(
      compileNode(PLAN_TASK, { w: 100, h: 50, scope: taskScope() }).outline,
    ).toEqual({ kind: 'rect' });
  });
});

describe('formula problems', () => {
  it('reports a broken formula and still draws the other parts', () => {
    const shape: NodeShape = {
      id: 'shp_x',
      kind: 'node',
      size: { width: 100, height: 50 },
      parts: [
        { type: 'rect', width: '100%', height: '100%', fill: '= 1 +' },
        {
          type: 'rect',
          width: 10,
          height: 10,
          fill: '#000000',
          stroke: '= Missing',
        },
      ],
    } as NodeShape;
    const c = compileNode(shape, { w: 100, h: 50, scope: scopeOf({}) });
    expect(c.ops.filter((o) => o.op === 'rect')).toHaveLength(2);
    expect(c.messages.some((m) => /Unexpected/.test(m))).toBe(true);
    expect(c.messages.some((m) => /not known/.test(m))).toBe(true);
  });
});

describe('layout', () => {
  const base = {
    id: 'shp_l',
    kind: 'node',
    size: { width: 100, height: 100 },
  } as const;

  it('repeats a part over table rows in a stack', () => {
    const shape = {
      ...base,
      parts: [
        {
          type: 'text',
          x: 4,
          y: 10,
          width: '100% - 8',
          height: 14,
          text: '= row.Step',
          repeat: {
            over: 'Steps',
            as: 'row',
            layout: { kind: 'stack', direction: 'column', gap: 2 },
          },
        },
      ],
    } as NodeShape;
    const c = compileNode(shape, {
      w: 100,
      h: 100,
      scope: scopeOf({ Steps: [{ Step: 'a' }, { Step: 'b' }, { Step: 'c' }] }),
    });
    const texts = c.ops.filter((o) => o.op === 'text');
    expect(texts.map((t) => t.op === 'text' && t.box.y)).toEqual([10, 26, 42]);
    expect(texts.map((t) => t.op === 'text' && t.lines[0]!.text)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('lays a repeat out as a grid', () => {
    const shape = {
      ...base,
      parts: [
        {
          type: 'rect',
          width: 10,
          height: 10,
          fill: '#000',
          repeat: {
            over: '[1,2,3,4,5]',
            layout: { kind: 'grid', columns: 2, gap: 4 },
          },
        },
      ],
    } as NodeShape;
    const c = compileNode(shape, { w: 100, h: 100, scope: scopeOf({}) });
    expect(rects(c.ops).map((r) => [r.box.x, r.box.y])).toEqual([
      [0, 0],
      [14, 0],
      [0, 14],
      [14, 14],
      [0, 28],
    ]);
  });

  it('places group children relative to the group and stacks them', () => {
    const shape = {
      ...base,
      parts: [
        {
          type: 'group',
          x: 10,
          y: 20,
          width: 60,
          height: 40,
          layout: { kind: 'stack', direction: 'column', gap: 0 },
          parts: [
            { type: 'rect', fill: '#111' },
            { type: 'rect', fill: '#222' },
          ],
        },
      ],
    } as NodeShape;
    const c = compileNode(shape, { w: 100, h: 100, scope: scopeOf({}) });
    expect(rects(c.ops).map((r) => r.box)).toEqual([
      { x: 10, y: 20, w: 60, h: 20 },
      { x: 10, y: 40, w: 60, h: 20 },
    ]);
  });

  it('wraps clip and transform in save and restore', () => {
    const shape = {
      ...base,
      parts: [
        {
          type: 'group',
          width: 50,
          height: 50,
          clip: true,
          transform: { rotate: 90 },
          parts: [{ type: 'rect', fill: '#000' }],
        },
      ],
    } as NodeShape;
    const c = compileNode(shape, { w: 100, h: 100, scope: scopeOf({}) });
    expect(c.ops.map((o) => o.op)).toEqual([
      'save',
      'transform',
      'save',
      'clip',
      'rect',
      'restore',
      'restore',
    ]);
  });

  it('chooses the first matching variant', () => {
    const shape = {
      ...base,
      parts: [],
      variants: [
        {
          when: "= Status == 'Done'",
          parts: [{ type: 'rect', fill: '#0f0', width: 5, height: 5 }],
        },
        { parts: [{ type: 'rect', fill: '#f00', width: 5, height: 5 }] },
      ],
    } as NodeShape;
    const fill = (status: string) =>
      rects(
        compileNode(shape, { w: 10, h: 10, scope: scopeOf({ Status: status }) })
          .ops,
      )[0]!.style.fill;
    expect(fill('Done')).toBe('#0f0');
    expect(fill('Open')).toBe('#f00');
  });

  it('embeds another shape with use, and stops on a cycle', () => {
    const inner = {
      id: 'shp_in',
      kind: 'node',
      size: { width: 10, height: 10 },
      parts: [{ type: 'rect', width: '100%', height: '100%', fill: '#abc' }],
    } as NodeShape;
    const loop = {
      id: 'shp_loop',
      kind: 'node',
      size: { width: 10, height: 10 },
      parts: [{ type: 'use', shape: 'shp_loop' }],
    } as NodeShape;
    const outer = {
      id: 'shp_out',
      kind: 'node',
      size: { width: 100, height: 100 },
      parts: [
        { type: 'use', shape: 'shp_in', x: 10, y: 10, width: 40, height: 20 },
        { type: 'use', shape: 'shp_none' },
      ],
    } as NodeShape;
    const table = new Map<string, ShapeDef>([
      ['shp_in', inner],
      ['shp_loop', loop],
      ['shp_out', outer],
    ]);
    const shapes = (id: ShapeId) => table.get(id);
    const c = compileNode(outer, {
      w: 100,
      h: 100,
      scope: scopeOf({}),
      shapes,
    });
    expect(rects(c.ops)[0]!.box).toEqual({ x: 10, y: 10, w: 40, h: 20 });
    expect(c.messages.some((m) => /does not exist/.test(m))).toBe(true);
    expect(
      compileNode(loop, {
        w: 10,
        h: 10,
        scope: scopeOf({}),
        shapes,
      }).messages.some((m) => /uses itself/.test(m)),
    ).toBe(true);
  });
});

describe('relation shape', () => {
  it('is dashed and labelled when there is a condition', () => {
    const plain = compileRelation(PLAN_FLOW, scopeOf({ Condition: '' }));
    const cond = compileRelation(
      PLAN_FLOW,
      scopeOf({ Condition: 'amount > 100' }),
    );
    expect(plain.line.dash).toEqual([]);
    expect(plain.labels).toEqual([]);
    expect(cond.line.dash).toEqual([6, 4]);
    expect(cond.labels[0]!.text).toBe('amount > 100');
    expect(cond.labels[0]!.offset).toEqual({ x: 0, y: -10 });
    expect(cond.labels[0]!.background).toBe('#FFFFFF');
    expect(cond.end).toMatchObject({ type: 'arrow', fill: '#202124' });
    expect(cond.start).toBeNull();
    expect(cond.line).toMatchObject({
      routing: 'orthogonal',
      corners: 6,
      stroke: '#202124',
      width: 1.5,
    });
  });
});

describe('cache', () => {
  it('rebuilds only when the shape, size or a value that was read changes', () => {
    const cache = new CompileCache();
    const shapes = () => undefined;
    const a = cache.get(undefined, PLAN_TASK, 140, 70, taskScope(), shapes);
    expect(cache.builds).toBe(1);
    expect(
      cache.get(a, PLAN_TASK, 140, 70, taskScope({ Unrelated: 5 }), shapes),
    ).toBe(a);
    expect(cache.builds).toBe(1);
    const b = cache.get(
      a,
      PLAN_TASK,
      140,
      70,
      taskScope({ Priority: 'Low' }),
      shapes,
    );
    expect(b).not.toBe(a);
    expect(
      cache.get(b, PLAN_TASK, 150, 70, taskScope({ Priority: 'Low' }), shapes),
    ).not.toBe(b);
    expect(
      cache.get(
        b,
        { ...PLAN_TASK },
        140,
        70,
        taskScope({ Priority: 'Low' }),
        shapes,
      ),
    ).not.toBe(b);
    expect(cache.builds).toBe(4);
  });

  it('notices when an embedded shape is edited', () => {
    const cache = new CompileCache();
    const inner = {
      id: 'shp_in',
      kind: 'node',
      size: { width: 10, height: 10 },
      parts: [],
    } as NodeShape;
    const outer = {
      id: 'shp_out',
      kind: 'node',
      size: { width: 10, height: 10 },
      parts: [{ type: 'use', shape: 'shp_in' }],
    } as NodeShape;
    let current: ShapeDef = inner;
    const shapes = () => current;
    const a = cache.get(undefined, outer, 10, 10, scopeOf({}), shapes);
    current = { ...inner };
    expect(cache.get(a, outer, 10, 10, scopeOf({}), shapes)).not.toBe(a);
  });
});

describe('starter shapes', () => {
  const scope = scopeOf({
    $label: 'Hello world',
    $fill: '#eef4ff',
    $fields: ['Owner: Anna', 'Cost: 5'],
  });
  it.each(Object.values(STARTER_SHAPES).filter((s) => s.kind === 'node'))(
    '$id compiles without messages at three sizes',
    (shape) => {
      const node = shape as NodeShape;
      for (const f of [0.5, 1, 2]) {
        const c = compileNode(node, {
          w: node.size.width * f,
          h: node.size.height * f,
          scope,
        });
        expect(c.messages).toEqual([]);
        expect(c.ops.length).toBeGreaterThan(0);
      }
    },
  );

  it('chooses by kind and key like the phase 2 rules', () => {
    const id = (kind: 'node' | 'container' | 'swimlane', key: string) =>
      starterFor({ kind, key }).id;
    expect(id('node', 'StartEvent')).toBe('shp_starter_event');
    expect(id('node', 'Gateway')).toBe('shp_starter_gateway');
    expect(id('node', 'Entity')).toBe('shp_starter_er_entity');
    expect(id('node', 'Task')).toBe('shp_starter_task');
    expect(id('container', 'Pool')).toBe('shp_starter_container');
    expect(id('swimlane', 'Lane')).toBe('shp_starter_swimlane');
  });

  it('draws the diamond outline as a polygon', () => {
    const g = STARTER_SHAPES.shp_starter_gateway as NodeShape;
    const c = compileNode(g, { w: 70, h: 70, scope });
    expect(c.outline).toEqual({
      kind: 'polygon',
      points: [
        [35, 0],
        [70, 35],
        [35, 70],
        [0, 35],
      ],
    });
  });
});
