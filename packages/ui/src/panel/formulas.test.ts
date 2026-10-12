import { describe, expect, it } from 'vitest';
import {
  ModelCalculator,
  validateModel,
  type ElementId,
  type Model,
  type PanelLayout,
  type Kit,
} from '@metakit-app/core';
import { buildLayoutPanelFor, type LayoutNode } from './layout';
import { buildPanel, objectMessages, type Field } from './model';
import { makeStore } from './testing';

function setup(kit?: (t: Kit) => Kit) {
  const made = makeStore('bpmn-lite');
  const used = kit ? kit(made.kit) : made.kit;
  const calc = new ModelCalculator(used, () => made.store.state as Model);
  calc.attach(made.store);
  return { ...made, kit: used, calc };
}

const allFields = (nodes: LayoutNode[]): Field[] =>
  nodes.flatMap((n) => (n.kind === 'field' ? [n.field] : allFields(n.items)));

describe('panel with a calculator', () => {
  it('shows a formula attribute read-only with its calculated value', () => {
    const { kit, store, create, calc } = setup();
    const t = create('cls_task', { att_effort: 2 } as never);
    const find = () =>
      buildPanel(kit, store.state, [{ id: t }], [], 'en', {
        calculator: calc,
      })
        .flatMap((s) => s.fields)
        .find((f) => f.attr.key === 'Cost')!;
    expect(find().readOnly).toBe(true);
    expect(find().value).toBe('170');
    store.execute({
      type: 'setAttribute',
      target: t,
      attr: 'att_effort' as never,
      value: 3,
    });
    expect(find().value).toBe('255');
  });

  it('shows the problem of a formula under its value in plain English', () => {
    const { kit, store, create, calc } = setup();
    // Effort is empty, so Effort * 85 cannot be calculated.
    const t = create('cls_task');
    const cost = buildPanel(kit, store.state, [{ id: t }], [], 'en', {
      calculator: calc,
    })
      .flatMap((s) => s.fields)
      .find((f) => f.attr.key === 'Cost')!;
    expect(cost.value).toBeUndefined();
    expect(cost.error).toMatch(/formula/i);
  });

  it('puts a constraint message under the attribute its formula names', () => {
    const { kit, store, create, calc } = setup((t) => ({
      ...t,
      classes: {
        ...t.classes,
        cls_task: {
          ...t.classes['cls_task' as never]!,
          constraints: [
            {
              id: 'k1',
              formula: 'Effort > 0',
              message: 'Effort must be above zero',
            },
            {
              id: 'k2',
              formula: 'Effort > 0 && Cost > 0',
              message: 'Effort and cost go together',
            },
          ],
        },
      } as never,
    }));
    const task = create('cls_task', { att_effort: 0 } as never);
    const issues = validateModel(kit, store.state as Model, calc);
    const fields = buildPanel(kit, store.state, [{ id: task }], issues, 'en', {
      calculator: calc,
    }).flatMap((s) => s.fields);
    expect(fields.find((f) => f.attr.key === 'Effort')!.issues).toContain(
      'Effort must be above zero',
    );
    expect(objectMessages(issues, [task])).toEqual([
      'Effort and cost go together',
    ]);
  });
});

describe('layout panel with a calculator', () => {
  const layout = (visible: string): PanelLayout => ({
    class: 'cls_task' as never,
    tabs: [
      {
        label: 'Main',
        items: [
          { attribute: 'Name' },
          { attribute: 'Cost' },
          { attribute: 'Owner', visible },
        ],
      },
    ],
  });
  const withLayout = (visible: string) => (t: Kit) => ({
    ...t,
    panels: { cls_task: layout(visible) } as never,
  });

  it('evaluates conditions with helpers such as parent and count', () => {
    const { kit, store, create, calc } = setup(
      withLayout('= count(objects("Task")) > 1'),
    );
    const a = create('cls_task');
    const owner = () =>
      allFields(
        buildLayoutPanelFor(kit, store.state, [{ id: a }], [], 'en', {
          calculator: calc,
        })!.tabs[0]!.items,
      );
    const visible = () =>
      buildLayoutPanelFor(kit, store.state, [{ id: a }], [], 'en', {
        calculator: calc,
      })!.tabs[0]!.items.filter((n) => n.kind === 'field' && n.visible).length;
    expect(owner().length).toBe(3);
    expect(visible()).toBe(2);
    create('cls_task');
    expect(visible()).toBe(3);
  });

  it('uses parent in a condition and shows computed values', () => {
    const { kit, store, create, calc } = setup(withLayout('= parent != null'));
    const a = create('cls_task', { att_effort: 1 } as never);
    const panel = () =>
      buildLayoutPanelFor(kit, store.state, [{ id: a }], [], 'en', {
        calculator: calc,
      })!;
    const ownerNode = () =>
      panel().tabs[0]!.items.find(
        (n) => n.kind === 'field' && n.field.attr.key === 'Owner',
      ) as Extract<LayoutNode, { kind: 'field' }>;
    expect(ownerNode().visible).toBe(false);
    const cost = panel().tabs[0]!.items.find(
      (n) => n.kind === 'field' && n.field.attr.key === 'Cost',
    ) as Extract<LayoutNode, { kind: 'field' }>;
    expect(cost.field.value).toBe('85');
    expect(cost.field.readOnly).toBe(true);
    void (a as ElementId);
  });

  it('works without a calculator as before', () => {
    const { kit, store, create } = setup(withLayout('= Effort > 0'));
    const a = create('cls_task', { att_effort: 1 } as never);
    const panel = buildLayoutPanelFor(kit, store.state, [{ id: a }], []);
    expect(panel!.tabs[0]!.items).toHaveLength(3);
  });
});
