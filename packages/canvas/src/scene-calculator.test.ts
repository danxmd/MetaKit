import { describe, expect, it } from 'vitest';
import {
  ModelCalculator,
  type ElementId,
  type Model,
  type NodeShape,
  type ToolLibrary,
} from '@metakit-app/core';
import { Scene } from './scene';
import { BPMN, bpmnStore } from './testing';

const shape: NodeShape = {
  id: 'shp_calc',
  kind: 'node',
  size: { width: 100, height: 50 },
  parts: [
    {
      type: 'rect',
      width: '100%',
      height: '100%',
      fill: "= Cost > 200 ? '#ff0000' : '#ffffff'",
    },
    {
      type: 'text',
      text: '= count(objects("Task")) + " tasks"',
      width: '100%',
      height: '100%',
    },
  ],
};

function setup() {
  const base = bpmnStore();
  const tool: ToolLibrary = {
    ...base.tool,
    shapes: { shp_calc: shape },
    classes: {
      ...base.tool.classes,
      [BPMN.task]: { ...base.tool.classes[BPMN.task]!, shape: 'shp_calc' },
    },
  };
  const calc = new ModelCalculator(tool, () => base.store.state as Model);
  calc.attach(base.store);
  // The scene follows the store after the calculator, as the app wires them.
  const scene = new Scene(base.store.state as Model, tool, {
    calculator: calc,
  });
  scene.attach(base.store);
  const create = (effort: number) =>
    (
      base.store.execute({
        type: 'createElement',
        class: BPMN.task as never,
        x: 0,
        y: 0,
        w: 100,
        h: 50,
        attrs: { [BPMN.name]: 'T', att_effort: effort } as never,
      }) as unknown as { value: ElementId }
    ).value;
  const ops = (id: ElementId) => scene.elements.get(id)!.compiled.compiled.ops;
  const fill = (id: ElementId) => {
    const op = ops(id).find((o) => o.op === 'rect');
    return op && 'style' in op ? op.style.fill : undefined;
  };
  const text = (id: ElementId) =>
    ops(id).flatMap((o) => (o.op === 'text' ? o.lines.map((l) => l.text) : []));
  return { ...base, tool, calc, scene, create, fill, text };
}

describe('Scene with a calculator', () => {
  it('redraws a shape that reads a formula attribute when its input changes', () => {
    const { store, create, fill } = setup();
    const t = create(2);
    expect(fill(t)).toBe('#ffffff');
    store.execute({
      type: 'setAttribute',
      target: t,
      attr: 'att_effort' as never,
      value: 3,
    });
    expect(fill(t)).toBe('#ff0000');
    store.undo();
    expect(fill(t)).toBe('#ffffff');
  });

  it('updates a shape that counts objects when a task is created or deleted', () => {
    const { store, create, text } = setup();
    const a = create(1);
    expect(text(a).join(' ')).toContain('1 tasks');
    const b = create(1);
    expect(text(a).join(' ')).toContain('2 tasks');
    store.execute({ type: 'delete', id: b });
    expect(text(a).join(' ')).toContain('1 tasks');
  });

  it('tells its listeners about redrawn items, and stops after destroy', () => {
    const { store, create, scene, calc } = setup();
    const a = create(1);
    const seen: string[][] = [];
    scene.onChange((c) => seen.push([...c.ids]));
    create(1);
    expect(seen.flat()).toContain(a);
    scene.destroy();
    const before = seen.length;
    calc.setTool(calc['tool'] as ToolLibrary);
    expect(seen.length).toBe(before);
    void store;
  });

  it('can be given a calculator later', () => {
    const base = bpmnStore();
    const scene = new Scene(base.store.state as Model, base.tool);
    scene.setCalculator(
      new ModelCalculator(base.tool, () => base.store.state as Model),
    );
    expect(scene.elements.size).toBe(0);
  });
});
