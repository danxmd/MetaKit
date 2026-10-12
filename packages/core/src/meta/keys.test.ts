import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SAMPLE, sampleKit } from '../testing/sample-kit';
import { createKitStore } from './commands';
import { validateKit } from './guards';
import { findKeyUsages, keyProblem } from './keys';
import type { NodeShape } from './shape-types';
import type { AttributeDef, Kit } from './types';

/** The sample Kit with a shape and a panel layout that read the Name attribute of the task. */
function kitWithUses(): Kit {
  const kit = sampleKit();
  const shape = {
    id: 'shp_task',
    kind: 'node',
    size: { width: 100, height: 50 },
    let: { accent: "= Name == 'Name' ? '#f00' : '#00f'" },
    parts: [
      { type: 'rect', width: '100%', height: '100%', fill: '= accent' },
      { type: 'text', text: '= Name', visible: '= Name != null' },
      { type: 'text', text: 'Name', repeat: { over: 'Name', as: 'x' } },
    ],
    variants: [{ when: '= Name == null', parts: [] }],
  } as NodeShape;
  return {
    ...kit,
    shapes: { shp_task: shape },
    panels: {
      [SAMPLE.task]: {
        class: SAMPLE.task,
        tabs: [
          {
            label: 'General',
            items: [
              { attribute: 'Name', readOnly: '= Name == null' },
              { group: 'G', items: [{ attribute: 'Name2', visible: false }] },
            ],
          },
        ],
      },
    },
    classes: {
      ...kit.classes,
      [SAMPLE.task]: { ...kit.classes[SAMPLE.task]!, shape: 'shp_task' },
    },
  } as unknown as Kit;
}

const nameAttr = (kit: Kit): AttributeDef =>
  Object.values(kit.classes)
    .flatMap((c) => c.attributes)
    .find((a) => a.key === 'Name')!;

describe('renameKey and simple looks', () => {
  it('rewrites the keys a look names, and leaves colour values alone', () => {
    const kit = sampleKit();
    const shape = {
      id: 'shp_look',
      kind: 'node',
      size: { width: 100, height: 50 },
      parts: [{ type: 'text', text: '= Priority' }],
      look: {
        base: 'header-box',
        fill: {
          by: 'Priority',
          values: { Priority: '#0f0' },
          fallback: '#fff',
        },
        border: '#000',
        borderWidth: 1,
        borderStyle: 'solid',
        title: { attribute: 'Priority' },
        subtitle: { attribute: null },
        badge: {
          attribute: 'Priority',
          equals: 'High',
          text: 'H',
          colour: '#f00',
        },
        fields: ['Name', 'Priority'],
        size: { width: 100, height: 50 },
      },
    } as unknown as NodeShape;
    const t = {
      ...kit,
      shapes: { shp_look: shape },
      classes: {
        ...kit.classes,
        [SAMPLE.task]: { ...kit.classes[SAMPLE.task]!, shape: 'shp_look' },
      },
    } as unknown as Kit;
    const store = createKitStore(t);
    store.execute({
      type: 'renameKey',
      scope: {
        kind: 'attribute',
        owner: { kind: 'class', id: SAMPLE.task },
        id: SAMPLE.attPriority,
      },
      newKey: 'Urgency',
    });
    const look = (store.state.shapes.shp_look as NodeShape).look!;
    expect(look.fill).toEqual({
      by: 'Urgency',
      values: { Priority: '#0f0' },
      fallback: '#fff',
    });
    expect(look.title.attribute).toBe('Urgency');
    expect(look.subtitle!.attribute).toBeNull();
    expect(look.badge!.attribute).toBe('Urgency');
    expect(look.badge!.equals).toBe('High');
    expect(look.fields).toEqual(['Name', 'Urgency']);
    expect((store.state.shapes.shp_look as NodeShape).parts[0]).toEqual({
      type: 'text',
      text: '= Urgency',
    });
  });
});

describe('renameKey', () => {
  it('rewrites formulas, shapes and panel layouts, and leaves strings and longer names alone', () => {
    const kit = kitWithUses();
    // Make the panel valid for this test: it lists attributes the class has.
    delete (kit.panels[SAMPLE.task]!.tabs[0]!.items as unknown[])[1];
    kit.panels[SAMPLE.task]!.tabs[0]!.items.length = 1;
    const owner = Object.values(kit.classes).find((c) =>
      c.attributes.some((a) => a.key === 'Name'),
    )!;
    const store = createKitStore(kit);
    const attr = nameAttr(kit);
    store.execute({
      type: 'renameKey',
      scope: {
        kind: 'attribute',
        owner: { kind: 'class', id: owner.id },
        id: attr.id,
      },
      newKey: 'Title2',
    });
    const after = store.state;
    const shape = after.shapes.shp_task as NodeShape;
    expect(shape.let!.accent).toBe("= Title2 == 'Name' ? '#f00' : '#00f'");
    expect((shape.parts[1] as { text: string; visible: string }).text).toBe(
      '= Title2',
    );
    expect((shape.parts[1] as { visible: string }).visible).toBe(
      '= Title2 != null',
    );
    expect((shape.parts[2] as { text: string }).text).toBe('Name');
    expect((shape.parts[2] as { repeat: { over: string } }).repeat.over).toBe(
      'Title2',
    );
    expect(shape.variants![0]!.when).toBe('= Title2 == null');
    const item = after.panels[SAMPLE.task]!.tabs[0]!.items[0] as {
      attribute: string;
      readOnly: string;
    };
    expect(item.attribute).toBe('Title2');
    expect(item.readOnly).toBe('= Title2 == null');
    expect(
      after.classes[owner.id]!.attributes.find((a) => a.id === attr.id)!.key,
    ).toBe('Title2');
    expect(validateKit(after)).toEqual([]);
    store.undo();
    expect(store.state).toEqual(kit);
  });

  it('rewrites formula attributes of the class and its subclasses', () => {
    const kit = sampleKit();
    const store = createKitStore(kit);
    const base = Object.values(kit.classes).find(
      (c) =>
        c.attributes.length > 0 &&
        Object.values(kit.classes).some((d) => d.extends === c.id),
    )!;
    const attr = base.attributes[0]!;
    const sub = Object.values(kit.classes).find((d) => d.extends === base.id)!;
    store.execute({
      type: 'putAttribute',
      owner: { kind: 'class', id: sub.id },
      def: {
        id: 'att_calc',
        key: 'Calc',
        type: 'formula',
        formula: `${attr.key} * 2`,
      } as AttributeDef,
    });
    expect(
      findKeyUsages(store.state, {
        kind: 'attribute',
        owner: { kind: 'class', id: base.id },
        id: attr.id,
      }),
    ).toContain(`a formula attribute of "${sub.key}"`);
    store.execute({
      type: 'renameKey',
      scope: {
        kind: 'attribute',
        owner: { kind: 'class', id: base.id },
        id: attr.id,
      },
      newKey: 'Renamed',
    });
    const calc = store.state.classes[sub.id]!.attributes.find(
      (a) => a.id === 'att_calc',
    ) as { formula: string };
    expect(calc.formula).toBe('Renamed * 2');
  });

  it('refuses bad, reserved and clashing keys, and nothing changes', () => {
    const kit = sampleKit();
    const store = createKitStore(kit);
    const cls = Object.values(kit.classes).find(
      (c) => c.attributes.length >= 1,
    )!;
    const attr = cls.attributes[0]!;
    const scope = {
      kind: 'attribute',
      owner: { kind: 'class', id: cls.id },
      id: attr.id,
    } as const;
    expect(() =>
      store.execute({ type: 'renameKey', scope, newKey: '1bad' }),
    ).toThrow(/starts with a letter/);
    expect(() =>
      store.execute({ type: 'renameKey', scope, newKey: 'true' }),
    ).toThrow(/reserved/);
    const other = Object.values(kit.classes).find((c) => c.key !== cls.key)!;
    expect(() =>
      store.execute({
        type: 'renameKey',
        scope: { kind: 'class', id: cls.id },
        newKey: other.key,
      }),
    ).toThrow(/already used/);
    store.execute({
      type: 'renameKey',
      scope: { kind: 'class', id: cls.id },
      newKey: 'BrandNew',
    });
    expect(store.state.classes[cls.id]!.key).toBe('BrandNew');
    expect(keyProblem('Fine_1')).toBeNull();
  });

  it('refuses a key that a subclass already has', () => {
    const kit = sampleKit();
    const store = createKitStore(kit);
    const base = Object.values(kit.classes).find((c) =>
      Object.values(kit.classes).some(
        (d) => d.extends === c.id && d.attributes.length > 0,
      ),
    )!;
    const sub = Object.values(kit.classes).find(
      (d) => d.extends === base.id && d.attributes.length > 0,
    )!;
    store.execute({
      type: 'putAttribute',
      owner: { kind: 'class', id: base.id },
      def: { id: 'att_tmp', key: 'Tmp', type: 'text' } as AttributeDef,
    });
    expect(() =>
      store.execute({
        type: 'renameKey',
        scope: {
          kind: 'attribute',
          owner: { kind: 'class', id: base.id },
          id: 'att_tmp',
        },
        newKey: sub.attributes[0]!.key,
      }),
    ).toThrow(/already used/);
  });

  it('a rename never changes what a formula reads (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('A', 'B', 'AB', 'Total'),
        fc.constantFrom('Z', 'Q1', 'New_name'),
        (from, to) => {
          const kit = sampleKit();
          const store = createKitStore(kit);
          const cls = Object.values(kit.classes)[0]!;
          store.execute({
            type: 'putAttribute',
            owner: { kind: 'class', id: cls.id },
            def: { id: 'att_x', key: from, type: 'number' } as AttributeDef,
          });
          store.execute({
            type: 'putAttribute',
            owner: { kind: 'class', id: cls.id },
            def: {
              id: 'att_f',
              key: 'F',
              type: 'formula',
              formula: `${from} + AB + '${from}'`,
            } as AttributeDef,
          });
          store.execute({
            type: 'renameKey',
            scope: {
              kind: 'attribute',
              owner: { kind: 'class', id: cls.id },
              id: 'att_x',
            },
            newKey: to,
          });
          const f = store.state.classes[cls.id]!.attributes.find(
            (a) => a.id === 'att_f',
          ) as { formula: string };
          expect(f.formula).toBe(
            `${to} + ${from === 'AB' ? to : 'AB'} + '${from}'`,
          );
        },
      ),
    );
  });
});

describe('attribute commands', () => {
  it('adds, moves, replaces and removes attributes, and refuses a key change through put', () => {
    const kit = sampleKit();
    const store = createKitStore(kit);
    const cls =
      Object.values(kit.classes).find((c) => c.attributes.length === 0) ??
      Object.values(kit.classes)[0]!;
    const owner = { kind: 'class', id: cls.id } as const;
    const n = store.state.classes[cls.id]!.attributes.length;
    store.execute({
      type: 'putAttribute',
      owner,
      def: { id: 'att_one', key: 'One', type: 'text' } as AttributeDef,
    });
    store.execute({
      type: 'putAttribute',
      owner,
      def: {
        id: 'att_two',
        key: 'Two',
        type: 'integer',
        min: 1,
      } as AttributeDef,
      index: 0,
    });
    expect(
      store.state.classes[cls.id]!.attributes.map((a) => a.key).slice(0, 1),
    ).toEqual(['Two']);
    store.execute({ type: 'moveAttribute', owner, id: 'att_two', to: n + 1 });
    expect(store.state.classes[cls.id]!.attributes.at(-1)!.key).toBe('Two');
    store.execute({
      type: 'putAttribute',
      owner,
      def: {
        id: 'att_one',
        key: 'One',
        type: 'text',
        required: true,
      } as AttributeDef,
    });
    expect(
      (
        store.state.classes[cls.id]!.attributes.find(
          (a) => a.id === 'att_one',
        ) as { required: boolean }
      ).required,
    ).toBe(true);
    expect(() =>
      store.execute({
        type: 'putAttribute',
        owner,
        def: { id: 'att_one', key: 'Other', type: 'text' } as AttributeDef,
      }),
    ).toThrow(/rename/);
    expect(() =>
      store.execute({
        type: 'putAttribute',
        owner,
        def: { id: 'att_dup', key: 'One', type: 'text' } as AttributeDef,
      }),
    ).toThrow(/already used/);
    expect(() =>
      store.execute({
        type: 'putAttribute',
        owner,
        def: {
          id: 'att_bad',
          key: 'Bad',
          type: 'choice',
        } as unknown as AttributeDef,
      }),
    ).toThrow(/not valid/);
    store.execute({ type: 'removeAttribute', owner, id: 'att_one' });
    expect(
      store.state.classes[cls.id]!.attributes.some((a) => a.id === 'att_one'),
    ).toBe(false);
    expect(validateKit(store.state)).toEqual([]);
  });

  it('removing an attribute also removes it from panel layouts', () => {
    const kit = kitWithUses();
    kit.panels[SAMPLE.task]!.tabs[0]!.items.length = 1;
    const owner = Object.values(kit.classes).find((c) =>
      c.attributes.some((a) => a.key === 'Name'),
    )!;
    const store = createKitStore(kit);
    store.execute({
      type: 'removeAttribute',
      owner: { kind: 'class', id: owner.id },
      id: nameAttr(kit).id,
    });
    expect(store.state.panels[SAMPLE.task]!.tabs[0]!.items).toEqual([]);
    store.undo();
    expect(store.state.panels[SAMPLE.task]!.tabs[0]!.items).toHaveLength(1);
  });
});
