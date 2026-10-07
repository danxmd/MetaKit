import type { ElementId } from '../ids';
import { describe, expect, it } from 'vitest';
import { createModelStore } from '../model/commands';
import type { Model } from '../model/types';
import type { AttributeDef, ToolLibrary } from '../meta/types';
import { SAMPLE, emptySampleModel, sampleTool } from '../testing/sample-tool';
import { ModelCalculator } from './calculator';

function setup(extraTask: AttributeDef[] = [], extraLane: AttributeDef[] = []) {
  const base = sampleTool();
  const tool: ToolLibrary = {
    ...base,
    classes: {
      ...base.classes,
      [SAMPLE.task]: {
        ...base.classes[SAMPLE.task]!,
        attributes: [...base.classes[SAMPLE.task]!.attributes, ...extraTask],
      },
      [SAMPLE.lane]: {
        ...base.classes[SAMPLE.lane]!,
        attributes: [...base.classes[SAMPLE.lane]!.attributes, ...extraLane],
      },
    },
  };
  const store = createModelStore(emptySampleModel(), { tool });
  const calc = new ModelCalculator(tool, () => store.state as Model);
  calc.attach(store);
  const task = (attrs: Record<string, unknown> = {}, parent?: string) =>
    (
      store.execute({
        type: 'createElement',
        class: SAMPLE.task,
        x: 0,
        y: 0,
        attrs: { [SAMPLE.attName]: 'T', ...attrs },
        ...(parent ? { parent } : {}),
      } as never) as unknown as { value: string }
    ).value as ElementId;
  return { tool, store, calc, task };
}

const formula = (id: string, key: string, text: string): AttributeDef =>
  ({ id, key, type: 'formula', formula: text }) as AttributeDef;

describe('ModelCalculator', () => {
  it('computes a formula attribute and follows its inputs', () => {
    const { store, calc, task } = setup();
    const t = task({ [SAMPLE.attEffort]: 2 });
    expect(calc.get(t, 'Cost')).toBe(170);
    store.execute({
      type: 'setAttribute',
      target: t,
      attr: SAMPLE.attEffort,
      value: 3,
    });
    expect(calc.get(t, 'Cost')).toBe(255);
    expect(calc.get(t, 'Priority')).toBe('Medium');
    expect(calc.errorOf(t, 'Cost')).toBeUndefined();
  });

  it('recomputes only what an edit touched', () => {
    const { store, calc, task } = setup();
    const ids = Array.from({ length: 50 }, (_, i) =>
      task({ [SAMPLE.attEffort]: i }),
    );
    for (const id of ids) calc.get(id, 'Cost');
    const before = calc.evaluations;
    store.execute({
      type: 'setAttribute',
      target: ids[7]!,
      attr: SAMPLE.attEffort,
      value: 100,
    });
    for (const id of ids) calc.get(id, 'Cost');
    expect(calc.evaluations - before).toBe(1);
    expect(calc.get(ids[7]!, 'Cost')).toBe(8500);
    // An attribute that no formula reads drops nothing.
    const again = calc.evaluations;
    store.execute({
      type: 'setAttribute',
      target: ids[8]!,
      attr: SAMPLE.attName,
      value: 'Renamed',
    });
    for (const id of ids) calc.get(id, 'Cost');
    expect(calc.evaluations).toBe(again);
  });

  it('tells listeners which objects changed', () => {
    const { store, calc, task } = setup();
    const a = task({ [SAMPLE.attEffort]: 1 });
    const b = task({ [SAMPLE.attEffort]: 1 });
    calc.get(a, 'Cost');
    calc.get(b, 'Cost');
    const heard: string[][] = [];
    calc.onChange((ids) => heard.push([...ids].sort()));
    store.execute({
      type: 'setAttribute',
      target: a,
      attr: SAMPLE.attEffort,
      value: 4,
    });
    expect(heard.flat()).toContain(a);
    expect(heard.flat()).not.toContain(b);
  });

  it('formulas read other formulas, and a loop is an error on every formula in it', () => {
    const { calc, task } = setup([
      formula('att_a', 'A', 'B + 1'),
      formula('att_b', 'B', 'A + 1'),
      formula('att_c', 'Double', 'Cost * 2'),
    ]);
    const t = task({ [SAMPLE.attEffort]: 1 });
    expect(calc.get(t, 'Double')).toBe(170);
    expect(calc.get(t, 'A')).toBeNull();
    expect(calc.errorOf(t, 'A')).toMatch(/loop/);
    expect(calc.errorOf(t, 'B')).toMatch(/loop/);
  });

  it('counts objects of a class and follows creates and deletes', () => {
    const { store, calc, task } = setup([
      formula('att_n', 'Tasks', 'count(objects("Task"))'),
      formula('att_f', 'Nodes', 'count(objects("FlowNode"))'),
    ]);
    const a = task();
    expect(calc.get(a, 'Tasks')).toBe(1);
    expect(calc.get(a, 'Nodes')).toBe(1);
    const b = task();
    expect(calc.get(a, 'Tasks')).toBe(2);
    store.execute({ type: 'delete', id: b as never });
    expect(calc.get(a, 'Tasks')).toBe(1);
    store.execute({
      type: 'createElement',
      class: SAMPLE.gateway,
      x: 0,
      y: 0,
    } as never);
    expect(calc.get(a, 'Nodes')).toBe(2);
    const evals = calc.evaluations;
    expect(calc.get(a, 'Tasks')).toBe(1);
    expect(calc.evaluations).toBe(evals);
  });

  it('reads the parent, the children and what is connected', () => {
    const { store, calc, task } = setup(
      [
        formula('att_p', 'Where', 'parent == null ? "top" : parent'),
        formula('att_k', 'Kids', 'count(children())'),
        formula('att_o', 'Next', 'count(outgoing("SequenceFlow"))'),
        formula('att_i', 'Prev', 'join(incoming("SequenceFlow").Name, ",")'),
      ],
      [],
    );
    const lane = (
      store.execute({
        type: 'createElement',
        class: SAMPLE.lane,
        x: 0,
        y: 0,
        w: 400,
        h: 300,
      } as never) as unknown as { value: string }
    ).value as ElementId;
    const a = task({ [SAMPLE.attName]: 'A' });
    const b = task({ [SAMPLE.attName]: 'B' });
    expect(calc.get(a, 'Where')).toBe('top');
    store.execute({
      type: 'move',
      id: a as never,
      x: 10,
      y: 10,
      parent: lane,
    } as never);
    expect(calc.get(a, 'Where')).toBe(lane);
    expect(calc.get(lane, 'LaneName')).toBe(null);
    expect(calc.evaluate(lane, 'count(children())').value).toBe(1);
    store.execute({
      type: 'createConnector',
      relation: SAMPLE.flow,
      from: a,
      to: b,
    } as never);
    expect(calc.get(a, 'Next')).toBe(1);
    expect(calc.get(b, 'Prev')).toBe('A');
    store.execute({
      type: 'setAttribute',
      target: a,
      attr: SAMPLE.attName,
      value: 'Alpha',
    });
    expect(calc.get(b, 'Prev')).toBe('Alpha');
  });

  it('runs one-off formulas with the names of the object and extras', () => {
    const { calc, task } = setup();
    const t = task({ [SAMPLE.attEffort]: 2, [SAMPLE.attPriority]: 'High' });
    expect(calc.evaluate(t, "Priority == 'High' && Cost > 100").value).toBe(
      true,
    );
    expect(calc.evaluate(t, '= $new + 1', { $new: 4 }).value).toBe(5);
    expect(calc.evaluate(t, 'self').value).toBe(t);
    expect(calc.evaluate(t, 'Nope').error).toMatch(/not known/);
  });

  it('takes a changed tool library', () => {
    const { tool, calc, task } = setup();
    const t = task({ [SAMPLE.attEffort]: 2 });
    expect(calc.get(t, 'Cost')).toBe(170);
    const changed: ToolLibrary = {
      ...tool,
      classes: {
        ...tool.classes,
        [SAMPLE.task]: {
          ...tool.classes[SAMPLE.task]!,
          attributes: tool.classes[SAMPLE.task]!.attributes.map((a) =>
            a.key === 'Cost'
              ? ({ ...a, formula: 'Effort * 100' } as AttributeDef)
              : a,
          ),
        },
      },
    };
    calc.setTool(changed);
    expect(calc.get(t, 'Cost')).toBe(200);
  });

  it('recalculates one changed input among 5,000 formula attributes in under 50 ms', () => {
    const { tool } = setup();
    // Built directly: making 5,000 elements through commands would measure the store, not this.
    const elements: Record<string, unknown> = {};
    const ids: string[] = [];
    for (let i = 0; i < 5000; i++) {
      const id = `el_n${String(i).padStart(6, '0')}`;
      ids.push(id);
      elements[id] = {
        id,
        class: SAMPLE.task,
        x: 0,
        y: 0,
        w: 100,
        h: 50,
        pos: String(i).padStart(6, '0'),
        attrs: { [SAMPLE.attEffort]: i % 10 },
      };
    }
    const model = { ...emptySampleModel(), elements } as unknown as Model;
    const store = createModelStore(model, { tool });
    const calc = new ModelCalculator(tool, () => store.state as Model);
    calc.attach(store);
    for (const id of ids) calc.get(id, 'Cost');
    const before = calc.evaluations;
    const t = Date.now();
    store.execute({
      type: 'setAttribute',
      target: ids[2500]!,
      attr: SAMPLE.attEffort,
      value: 99,
    } as never);
    expect(calc.get(ids[2500]!, 'Cost')).toBe(99 * 85);
    expect(Date.now() - t).toBeLessThan(50);
    expect(calc.evaluations - before).toBe(1);
    for (const id of ids) calc.get(id, 'Cost');
    expect(calc.evaluations - before).toBe(1);
  });
});
