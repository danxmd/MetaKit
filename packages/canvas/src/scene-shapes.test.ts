import { describe, expect, it } from 'vitest';
import type {
  ElementId,
  Model,
  NodeShape,
  RelationShape,
  ToolLibrary,
} from '@metakit-app/core';
import { Scene } from './scene';
import { BPMN, bpmnStore } from './testing';

const shape = (fill: string): NodeShape => ({
  id: 'shp_custom',
  kind: 'node',
  size: { width: 100, height: 50 },
  outline: 'ellipse',
  parts: [
    {
      type: 'ellipse',
      width: '100%',
      height: '100%',
      fill: `= Name == 'Hot' ? '${fill}' : '#ffffff'`,
    },
    {
      type: 'text',
      text: '= Name',
      align: 'center',
      valign: 'middle',
      width: '100%',
      height: '100%',
    },
  ],
});

function setup(custom?: (tool: ToolLibrary) => ToolLibrary) {
  const base = bpmnStore();
  const tool = custom ? custom(base.tool) : base.tool;
  const model = base.store.state as Model;
  const scene = new Scene(model, tool);
  scene.attach(base.store);
  const create = (name: string) =>
    (
      base.store.execute({
        type: 'createElement',
        class: BPMN.task as never,
        x: 0,
        y: 0,
        w: 100,
        h: 50,
        attrs: { [BPMN.name]: name },
      }) as unknown as { value: ElementId }
    ).value;
  return { ...base, tool, scene, create };
}

const withShape =
  (fill: string) =>
  (tool: ToolLibrary): ToolLibrary => ({
    ...tool,
    shapes: { shp_custom: shape(fill) },
    classes: {
      ...tool.classes,
      [BPMN.task]: { ...tool.classes[BPMN.task]!, shape: 'shp_custom' },
    },
  });

describe('Scene with shapes', () => {
  it('draws classes without a shape from a starter shape and keeps their labels', () => {
    const { scene, create } = setup();
    const id = create('Hello');
    const item = scene.elements.get(id)!;
    expect(item.compiled.compiled.ops.some((o) => o.op === 'rect')).toBe(true);
    const text = item.compiled.compiled.ops.find((o) => o.op === 'text');
    expect(text?.op === 'text' && text.lines.map((l) => l.text).join(' ')).toBe(
      'Hello',
    );
    expect(item.label).toBe('Hello');
  });

  it('uses the class shape, follows an attribute it reads, and ignores one it does not', () => {
    const { scene, store, create } = setup(withShape('#ff0000'));
    const id = create('Cold');
    const fillOf = () => {
      const op = scene.elements
        .get(id)!
        .compiled.compiled.ops.find((o) => o.op === 'ellipse');
      return op?.op === 'ellipse' ? op.style.fill : null;
    };
    expect(scene.elements.get(id)!.outline).toEqual({ kind: 'ellipse' });
    expect(fillOf()).toBe('#ffffff');
    const builds = scene.cache.builds;
    store.execute({
      type: 'setAttribute',
      target: id,
      attr: BPMN.name,
      value: 'Hot',
    });
    expect(fillOf()).toBe('#ff0000');
    expect(scene.cache.builds).toBe(builds + 1);
    store.execute({ type: 'move', id, x: 20, y: 20 });
    expect(scene.cache.builds).toBe(builds + 1);
  });

  it('redraws everything when the tool library is replaced', () => {
    const { scene, tool, create } = setup(withShape('#ff0000'));
    const id = create('Hot');
    const fill = () => {
      const op = scene.elements
        .get(id)!
        .compiled.compiled.ops.find((o) => o.op === 'ellipse');
      return op?.op === 'ellipse' ? op.style.fill : null;
    };
    expect(fill()).toBe('#ff0000');
    scene.setTool(withShape('#00ff00')(tool));
    expect(fill()).toBe('#00ff00');
  });

  it('draws an element of a class the tool no longer has as a grey placeholder', () => {
    const { scene, tool, create } = setup();
    const id = create('Orphan');
    const { [BPMN.task]: _gone, ...rest } = tool.classes;
    void _gone;
    scene.setTool({ ...tool, classes: rest });
    const item = scene.elements.get(id)!;
    const rect = item.compiled.compiled.ops.find((o) => o.op === 'rect');
    expect(rect?.op === 'rect' && rect.style.fill).toBe('#e9ecef');
    expect(rect?.op === 'rect' && rect.style.dash).toEqual([5, 3]);
    expect(item.label).toMatch(/Unknown class/);
  });

  it('gives each connector the look of its relation shape, compiled once when it has no formulas', () => {
    const { scene, store, tool, create } = setup((t) => ({
      ...t,
      shapes: {
        shp_line: {
          id: 'shp_line',
          kind: 'relation',
          line: { stroke: '#ff0000', strokeWidth: 3, routing: 'straight' },
          endMarker: { type: 'diamond' },
        } as RelationShape,
      },
      relations: {
        ...t.relations,
        [BPMN.flow]: { ...t.relations[BPMN.flow]!, shape: 'shp_line' },
      },
    }));
    void tool;
    const a = create('A');
    const b = create('B');
    store.execute({ type: 'move', id: b, x: 300, y: 0 });
    const make = () =>
      (
        store.execute({
          type: 'createConnector',
          relation: BPMN.flow,
          from: a,
          to: b,
        }) as unknown as {
          value: never;
        }
      ).value;
    const one = scene.connectors.get(make())!;
    const two = scene.connectors.get(make())!;
    expect(one.look.line).toMatchObject({
      stroke: '#ff0000',
      width: 3,
      routing: 'straight',
    });
    expect(one.look.end?.type).toBe('diamond');
    expect(two.look).toBe(one.look);
    expect(one.route).toHaveLength(2);
  });
});
