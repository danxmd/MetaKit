import type { AttributeDef, NodeShape } from '@metakit-app/core';
import type { Scope, Value } from '@metakit-app/formula';
import { compileNode, STARTER_IDS } from '@metakit-app/shapes';
import { describe, expect, it } from 'vitest';
import { ShapeEditorModel } from './shape-editor-model';

const ATTRIBUTES = [
  { id: 'att_name', key: 'Name', type: 'text' },
  {
    id: 'att_prio',
    key: 'Priority',
    type: 'choice',
    options: ['High', 'Medium', 'Low'],
  },
  {
    id: 'att_type',
    key: 'TaskType',
    type: 'choice',
    options: ['Manual', 'Service'],
  },
  { id: 'att_owner', key: 'Owner', type: 'reference', target: {} },
  { id: 'att_effort', key: 'Effort', type: 'number' },
] as AttributeDef[];

const empty = (): NodeShape => ({
  id: 'shp_new',
  kind: 'node',
  size: { width: 140, height: 70, resizable: true },
  parts: [],
});

/** The task shape from the plan, as written there (the same as PLAN_TASK in compile.test.ts). */
const PLAN_TASK = {
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

const PRIORITY = [
  { value: 'High', colour: '#D93025' },
  { value: 'Medium', colour: '#F29900' },
];

/** Builds the plan's task shape with editor operations only. */
function buildTask(): ShapeEditorModel {
  const m = new ShapeEditorModel({
    shape: empty(),
    attributes: ATTRIBUTES,
    className: 'Task',
  });
  const set = (path: readonly number[], props: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(props)) m.setProp(k, v, path);
  };

  const frame = m.addPart('rect');
  set(frame, {
    x: 0,
    y: 0,
    width: '100%',
    height: '100%',
    radius: 10,
    fill: '#FFFFFF',
    strokeWidth: 2,
  });
  m.applyColourMap(frame, 'stroke', 'Priority', PRIORITY, '#5F6368');

  const bar = m.addPart('rect');
  set(bar, {
    x: 0,
    y: 0,
    width: 6,
    height: '100%',
    radius: 3,
    stroke: undefined,
    strokeWidth: undefined,
  });
  m.applyColourMap(bar, 'fill', 'Priority', PRIORITY, '#5F6368');

  const name = m.addPart('text');
  set(name, {
    x: 14,
    y: 8,
    width: '100% - 28',
    height: '100% - 26',
    text: '= Name',
    fit: 'shrink',
    'font.size': 13,
    'font.weight': 600,
  });

  const gear = m.addPart('image');
  set(gear, {
    src: 'assets/gear.3fa2c1.svg',
    x: '100% - 22',
    y: 4,
    width: 18,
    height: 18,
    visible: "= TaskType == 'Service'",
  });

  const owner = m.addPart('image');
  set(owner, {
    src: 'assets/person.9b81d0.svg',
    x: 6,
    y: '100% - 20',
    width: 14,
    height: 14,
    visible: '= Owner != null',
  });

  const effort = m.addPart('text');
  set(effort, {
    x: 14,
    y: '100% - 18',
    width: '100% - 28',
    height: 14,
    text: "= Effort ? Effort + ' h' : ''",
    align: 'right',
    valign: undefined,
    'font.size': 10,
    fill: '#5F6368',
  });

  m.setSample('att_name', 'Check order');
  m.setSample('att_effort', 3);
  return m;
}

const scopeOf = (values: Record<string, Value>): Scope => ({
  get: (n) => (Object.hasOwn(values, n) ? values[n] : undefined),
});

describe('the plan task shape built with editor operations only', () => {
  it('draws like the plan example for Priority High', () => {
    const m = buildTask();
    const mine = m.compilePreview(1).compiled;
    const plan = compileNode(PLAN_TASK, {
      w: 140,
      h: 70,
      scope: scopeOf({
        Name: 'Check order',
        Priority: 'High',
        TaskType: 'Manual',
        Owner: null,
        Effort: 3,
      }),
    });
    expect(mine.messages).toEqual([]);
    expect(mine.ops).toEqual(plan.ops);
    const rects = mine.ops.filter((o) => o.op === 'rect');
    expect(rects).toHaveLength(2);
    const texts = mine.ops.flatMap((o) =>
      o.op === 'text' ? o.lines.map((l) => l.text) : [],
    );
    expect(texts).toEqual(['Check order', '3 h']);
  });

  it('follows the attributes like the plan example', () => {
    const m = buildTask();
    m.setSample('att_prio', 'Low');
    m.setSample('att_type', 'Service');
    m.setSample('att_owner', 'el_anna');
    const plan = compileNode(PLAN_TASK, {
      w: 140,
      h: 70,
      scope: scopeOf({
        Name: 'Check order',
        Priority: 'Low',
        TaskType: 'Service',
        Owner: 'el_anna',
        Effort: 3,
      }),
    });
    const mine = m.compilePreview(1).compiled;
    expect(mine.ops).toEqual(plan.ops);
    expect(mine.ops.filter((o) => o.op === 'image')).toHaveLength(2);
  });

  it('draws like the plan example at the other two preview sizes', () => {
    const m = buildTask();
    for (const [scale, w, h] of [
      [0.5, 70, 35],
      [2, 280, 140],
    ] as const) {
      const p = m.compilePreview(scale);
      expect([p.width, p.height]).toEqual([w, h]);
      const plan = compileNode(PLAN_TASK, {
        w,
        h,
        scope: scopeOf({
          Name: 'Check order',
          Priority: 'High',
          TaskType: 'Manual',
          Owner: null,
          Effort: 3,
        }),
      });
      expect(p.compiled.ops).toEqual(plan.ops);
    }
  });

  it('reads the colour mapping back for the helper', () => {
    const m = buildTask();
    expect(m.colourMapOf([0], 'stroke')).toEqual({
      attribute: 'Priority',
      mapping: PRIORITY,
      fallback: '#5F6368',
    });
    expect(m.colourMapOf([0], 'fill')).toBeNull();
    expect(m.valuesOf('Priority')).toEqual(['High', 'Medium', 'Low']);
    expect(m.mappableAttributes().map((a) => a.key)).toEqual([
      'Priority',
      'TaskType',
    ]);
  });
});

describe('history and selection', () => {
  const fresh = () =>
    new ShapeEditorModel({ shape: empty(), attributes: ATTRIBUTES });

  it('undoes and redoes edits and tells the listeners', () => {
    const m = fresh();
    const seen: number[] = [];
    m.onChange((s) => seen.push(s.parts.length));
    m.addPart('rect');
    m.addPart('text');
    expect(m.draft.parts).toHaveLength(2);
    m.undo();
    expect(m.draft.parts).toHaveLength(1);
    m.redo();
    expect(m.draft.parts).toHaveLength(2);
    expect(seen).toEqual([1, 2, 1, 2]);
    expect(m.canRedo).toBe(false);
    m.undo();
    m.undo();
    expect(m.canUndo).toBe(false);
    m.undo();
    expect(m.draft.parts).toHaveLength(0);
  });

  it('a new edit clears redo', () => {
    const m = fresh();
    m.addPart('rect');
    m.undo();
    m.addPart('text');
    expect(m.canRedo).toBe(false);
  });

  it('makes a drag one undo step and one change for the host, but every move for views', () => {
    const m = fresh();
    m.addPart('rect');
    const changes: NodeShape[] = [];
    let redraws = 0;
    m.onChange((s) => changes.push(s));
    m.subscribe((e) => {
      if (e === 'shape') redraws++;
    });
    m.beginGesture();
    for (let i = 0; i < 5; i++) m.moveSelected(1, 0);
    expect(changes).toHaveLength(0);
    m.endGesture();
    expect(redraws).toBe(5);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toBe(m.draft);
    expect(m.draft.parts[0]).toMatchObject({ x: 15 });
    m.undo();
    expect(m.draft.parts[0]).toMatchObject({ x: 10 });
  });

  it('selects what was added and drops the selection when it is removed', () => {
    const m = fresh();
    const p = m.addPart('rect');
    expect(m.selection).toEqual(p);
    m.removeSelected();
    expect(m.selection).toBeNull();
    expect(m.draft.parts).toHaveLength(0);
    m.undo();
    expect(m.draft.parts).toHaveLength(1);
  });

  it('selects by clicking on the canvas', () => {
    const m = fresh();
    m.addPart('rect');
    m.addPart('ellipse');
    expect(m.selectAt(20, 20)).toEqual([1]);
    expect(m.selectAt(130, 60)).toBeNull();
    expect(m.selection).toBeNull();
  });

  it('keeps the selection on a part that moves in the layer order', () => {
    const m = fresh();
    m.addPart('rect');
    m.addPart('text');
    const to = m.reorder([1], 'bottom');
    expect(to).toEqual([0]);
    expect(m.selection).toEqual([0]);
    expect(m.draft.parts[0]!.type).toBe('text');
  });

  it('groups and ungroups the selection', () => {
    const m = fresh();
    m.addPart('rect');
    m.addPart('text');
    m.select([0]);
    m.toggleSelect([1]);
    const g = m.groupSelected();
    expect(g).toEqual([0]);
    expect(m.draft.parts).toHaveLength(1);
    expect(m.draft.parts[0]!.type).toBe('group');
    m.ungroupSelected();
    expect(m.draft.parts.map((p) => p.type)).toEqual(['rect', 'text']);
    expect(m.selectedPaths).toEqual([[0], [1]]);
  });

  it('adds new parts into a selected group', () => {
    const m = fresh();
    m.addPart('rect');
    m.groupSelected();
    m.addPart('text');
    expect(m.draft.parts).toHaveLength(1);
    expect(m.selection).toEqual([0, 1]);
  });

  it('shows and hides a part with the fixed flag', () => {
    const m = fresh();
    const p = m.addPart('rect');
    m.setVisible(p, false);
    expect(m.isVisibleFixed(p)).toBe(false);
    expect(m.compilePreview(1).compiled.ops).toHaveLength(0);
    m.setVisible(p, true);
    expect('visible' in m.draft.parts[0]!).toBe(false);
  });

  it('switches a property to a formula and back', () => {
    const m = fresh();
    const p = m.addPart('rect');
    m.toFormula('strokeWidth', 1, p);
    expect(m.getProp('strokeWidth')).toBe('= 1.5');
    expect(m.isFormulaProp('strokeWidth')).toBe(true);
    m.toFixed('strokeWidth', 1);
    expect(m.getProp('strokeWidth')).toBe(1.5);
  });

  it('completes names from the attributes and let names', () => {
    const m = fresh();
    m.setLet('accent', "= 'red'");
    expect(m.complete('Pri')[0]!.name).toBe('Priority');
    expect(m.complete('acc')[0]).toMatchObject({ name: 'accent', kind: 'let' });
  });

  it('resizes and moves through the selection', () => {
    const m = fresh();
    m.addPart('rect');
    m.resizeSelected({ dw: 10, dh: -5 });
    m.moveSelected(-2, 2);
    expect(m.draft.parts[0]).toMatchObject({
      width: 70,
      height: 35,
      x: 8,
      y: 12,
    });
  });

  it('duplicates the selection and sets the shape size and name', () => {
    const m = fresh();
    m.addPart('rect');
    expect(m.duplicateSelected()).toEqual([1]);
    m.setSize(200.4, 0);
    expect(m.draft.size).toMatchObject({ width: 200, height: 1 });
    m.setName('Box');
    expect(m.draft.name).toBe('Box');
    m.setName(' ');
    expect('name' in m.draft).toBe(false);
  });
});

describe('preview', () => {
  it('has the three sizes and starts from sample values', () => {
    const m = new ShapeEditorModel({
      shape: empty(),
      attributes: ATTRIBUTES,
      className: 'Task',
    });
    expect(m.previewScales).toEqual([0.5, 1, 2]);
    expect(m.samples).toMatchObject({
      att_name: 'Name',
      att_prio: 'High',
      att_effort: 3,
      att_owner: null,
    });
  });

  it('shows the stretching problem at the small and the large size', () => {
    const m = new ShapeEditorModel({ shape: empty() });
    const p = m.addPart('rect');
    m.setProp('x', 0, p);
    m.setProp('width', 100, p);
    const box = (scale: number) => {
      const op = m.compilePreview(scale).compiled.ops[0]!;
      return op.op === 'rect' ? op.box.w : -1;
    };
    // A fixed width does not follow the shape, which the strip makes visible at once.
    expect([box(0.5), box(1), box(2)]).toEqual([100, 100, 100]);
    m.setProp('width', '100%', p);
    expect([box(0.5), box(1), box(2)]).toEqual([70, 140, 280]);
  });

  it('uses the first text sample as the label and the class name otherwise', () => {
    const labelled = new ShapeEditorModel({
      shape: empty(),
      attributes: ATTRIBUTES,
      className: 'Task',
    });
    labelled.addPart('text');
    labelled.setProp('text', '= $label');
    labelled.setSample('att_name', 'Pay invoice');
    const text = (m: ShapeEditorModel) =>
      m
        .compilePreview(1)
        .compiled.ops.flatMap((o) => (o.op === 'text' ? o.lines : []))
        .map((l) => l.text);
    expect(text(labelled)).toEqual(['Pay invoice']);
    const bare = new ShapeEditorModel({ shape: empty(), className: 'Task' });
    bare.addPart('text');
    bare.setProp('text', '= $label');
    expect(text(bare)).toEqual(['Task']);
  });

  it('caches until the shape or the samples change', () => {
    const m = new ShapeEditorModel({ shape: empty(), attributes: ATTRIBUTES });
    m.addPart('rect');
    const a = m.compilePreview(1);
    expect(m.compilePreview(1)).toBe(a);
    m.setSample('att_effort', 4);
    expect(m.compilePreview(1)).not.toBe(a);
  });

  it('reports formula problems in plain text', () => {
    const m = new ShapeEditorModel({ shape: empty() });
    m.addPart('rect');
    m.setProp('fill', '= Missing + ');
    expect(m.compilePreview(1).compiled.messages.length).toBeGreaterThan(0);
  });

  it('keeps typed samples when the attributes are replaced', () => {
    const m = new ShapeEditorModel({ shape: empty(), attributes: ATTRIBUTES });
    m.setSample('att_name', 'Mine');
    m.setAttributes(ATTRIBUTES.slice(0, 2));
    expect(m.samples).toEqual({ att_name: 'Mine', att_prio: 'High' });
  });
});

describe('import and gallery', () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><circle cx="20" cy="20" r="10"/><path d="M0 0 L5 5"/><text x="40" y="20">Hi</text></svg>';

  it('imports an SVG as parts and takes its size into an empty shape', () => {
    const m = new ShapeEditorModel({ shape: empty() });
    const r = m.importSvg(SVG, 'parts');
    expect(r.skipped).toEqual([]);
    expect(m.draft.parts.map((p) => p.type)).toEqual([
      'ellipse',
      'path',
      'text',
    ]);
    expect(m.draft.size).toMatchObject({ width: 80, height: 40 });
    expect(m.selectedPaths).toHaveLength(3);
    m.undo();
    expect(m.draft.parts).toHaveLength(0);
    expect(m.draft.size.width).toBe(140);
  });

  it('keeps the size of a shape that has parts', () => {
    const m = new ShapeEditorModel({ shape: empty() });
    m.addPart('rect');
    m.importSvg(SVG, 'image');
    expect(m.draft.size.width).toBe(140);
    expect(m.draft.parts.map((p) => p.type)).toEqual(['rect', 'image']);
  });

  it('lists what a script file could not import and changes nothing for broken files', () => {
    const m = new ShapeEditorModel({ shape: empty() });
    const r = m.importSvg('<svg><script>x</script></svg>', 'parts');
    expect(r.skipped.join()).toMatch(/script/);
    const bad = m.importSvg('<svg>', 'parts');
    expect(bad.parts).toEqual([]);
    expect(m.draft.parts).toHaveLength(0);
    expect(m.canUndo).toBe(false);
  });

  it('turns an empty shape into a copy of a starter', () => {
    const m = new ShapeEditorModel({ shape: empty() });
    expect(m.addFromGallery(STARTER_IDS.task)).toBe(true);
    expect(m.draft.id).toBe('shp_new');
    expect(m.draft.parts.length).toBeGreaterThan(0);
    expect(m.draft.size.width).toBe(140);
    expect(m.addFromGallery('shp_nothing')).toBe(false);
    expect(m.addFromGallery(STARTER_IDS.flow)).toBe(false);
  });

  it('adds the starter as a group to a shape that has parts', () => {
    const m = new ShapeEditorModel({ shape: empty() });
    m.addPart('rect');
    m.addFromGallery(STARTER_IDS.event);
    expect(m.draft.parts).toHaveLength(2);
    expect(m.draft.parts[1]!.type).toBe('group');
    expect(m.selection).toEqual([1]);
  });
});
