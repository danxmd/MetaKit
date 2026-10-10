import { describe, expect, it } from 'vitest';
import {
  validateModel,
  type AttributeDef,
  type ElementId,
  type Kit,
} from '@metakit-app/core';
import { buildPanel, type Field } from './model';
import { loadKit, makeStore } from './testing';

const fieldsOf = (sections: ReturnType<typeof buildPanel>): Field[] =>
  sections.flatMap((s) => s.fields);
const byKey = (fields: Field[], key: string): Field => {
  const f = fields.find((x) => x.attr.key === key);
  if (!f) throw new Error(`no field ${key}`);
  return f;
};

describe('buildPanel with the sample Kits', () => {
  it('picks a control for every attribute type of a task', () => {
    const { kit, store, create } = makeStore('bpmn-lite');
    const task = create('cls_task', { att_name: 'Write' } as never);
    const model = store.state;
    const sections = buildPanel(kit, model, [{ id: task }], []);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.title).toBeUndefined();
    const f = fieldsOf(sections);
    const controls = Object.fromEntries(f.map((x) => [x.attr.key, x.control]));
    expect(controls).toEqual({
      Name: 'text',
      Description: 'textarea',
      Priority: 'segmented',
      Owner: 'reference',
      Effort: 'number',
      Cost: 'readonly',
      Due: 'date',
      Duration: 'duration',
      Tags: 'chips',
      Checklist: 'table',
      Spec: 'link',
      OpenSpec: 'button',
    });
    expect(byKey(f, 'Name')).toMatchObject({
      value: 'Write',
      mixed: false,
      required: true,
      readOnly: false,
    });
    expect(byKey(f, 'Cost').readOnly).toBe(true);
    expect(byKey(f, 'OpenSpec').readOnly).toBe(true);
    expect(byKey(f, 'Priority').options).toEqual([
      { value: 'Low', label: 'Low' },
      { value: 'Medium', label: 'Medium' },
      { value: 'High', label: 'High' },
    ]);
    expect(byKey(f, 'Owner').label).toBe('Owner');
    expect(byKey(f, 'Effort').value).toBeUndefined();
  });

  it('uses the language for labels and falls back to English', () => {
    const { kit, store, create } = makeStore('bpmn-lite');
    const task = create('cls_task');
    const f = fieldsOf(buildPanel(kit, store.state, [{ id: task }], [], 'de'));
    expect(byKey(f, 'Owner').label).toBe('Verantwortlich');
    expect(byKey(f, 'Effort').label).toBe(
      kit.classes['cls_task']!.attributes.find((a) => a.key === 'Effort')
        ?.labels?.['de'] ?? 'Effort',
    );
  });

  it('covers the er-lite types', () => {
    const { kit, store, create } = makeStore('er-lite');
    const a = create('cls_attribute');
    const f = fieldsOf(buildPanel(kit, store.state, [{ id: a }], []));
    expect(f.map((x) => x.control)).toEqual(['text', 'segmented', 'switch']);
  });

  it('shows a dash for differing values and the value when equal', () => {
    const { kit, store, create } = makeStore('bpmn-lite');
    const a = create('cls_task', { att_priority: 'High' } as never);
    const b = create('cls_task', { att_priority: 'Low' } as never);
    const c = create('cls_task', { att_priority: 'High' } as never);
    const mixed = byKey(
      fieldsOf(buildPanel(kit, store.state, [{ id: a }, { id: b }], [])),
      'Priority',
    );
    expect(mixed).toMatchObject({ mixed: true, value: undefined });
    const same = byKey(
      fieldsOf(buildPanel(kit, store.state, [{ id: a }, { id: c }], [])),
      'Priority',
    );
    expect(same).toMatchObject({ mixed: false, value: 'High' });
  });

  it('treats set and unset as different', () => {
    const { kit, store, create } = makeStore('bpmn-lite');
    const a = create('cls_task', { att_priority: 'High' } as never);
    const b = create('cls_task');
    const f = byKey(
      fieldsOf(buildPanel(kit, store.state, [{ id: a }, { id: b }], [])),
      'Priority',
    );
    expect(f.mixed).toBe(true);
  });

  it('shows only attributes common to all classes', () => {
    const { kit, store, create } = makeStore('bpmn-lite');
    const task = create('cls_task');
    const gw = create('cls_gateway');
    const lane = create('cls_lane');
    const keys = (ids: ElementId[]) =>
      fieldsOf(
        buildPanel(
          kit,
          store.state,
          ids.map((id) => ({ id })),
          [],
        ),
      ).map((f) => f.attr.key);
    expect(keys([task, gw])).toEqual(['Name', 'Description']);
    expect(keys([task, lane])).toEqual([]);
    expect(
      buildPanel(kit, store.state, [{ id: task }, { id: lane }], []),
    ).toEqual([]);
  });

  it('puts validation messages on the right field', () => {
    const { kit, store, create } = makeStore('bpmn-lite');
    const a = create('cls_task');
    const b = create('cls_task', { att_name: 'ok' } as never);
    // New tasks get the default name, so clear it to make the required rule fire.
    store.execute({
      type: 'setAttribute',
      target: a,
      attr: 'att_name',
      value: null,
    });
    const issues = validateModel(kit, store.state);
    const f = fieldsOf(buildPanel(kit, store.state, [{ id: a }], issues));
    expect(byKey(f, 'Name').issues).toHaveLength(1);
    expect(byKey(f, 'Name').issues[0]).toContain('required');
    expect(byKey(f, 'Description').issues).toEqual([]);
    const other = fieldsOf(buildPanel(kit, store.state, [{ id: b }], issues));
    expect(byKey(other, 'Name').issues).toEqual([]);
    // Issues without an attribute never show on a field.
    const loose = buildPanel(
      kit,
      store.state,
      [{ id: a }],
      [{ id: a, severity: 'error', code: 'x', message: 'general' }],
    );
    expect(fieldsOf(loose).every((x) => x.issues.length === 0)).toBe(true);
  });

  it('supports connectors, and rejects mixing with elements', () => {
    const { kit, store, create } = makeStore('bpmn-lite');
    const a = create('cls_task');
    const b = create('cls_task');
    const r = store.execute({
      type: 'createConnector',
      relation: 'rel_flow',
      from: a,
      to: b,
    });
    if (!r.ok) throw new Error('cancelled');
    const cn = r.value as never;
    const f = fieldsOf(buildPanel(kit, store.state, [{ id: cn }], []));
    expect(f.map((x) => x.attr.key)).toEqual(['Condition']);
    expect(buildPanel(kit, store.state, [{ id: cn }, { id: a }], [])).toEqual(
      [],
    );
  });

  it('is empty for no targets, missing targets and unknown classes', () => {
    const { kit, store, create } = makeStore('bpmn-lite');
    expect(buildPanel(kit, store.state, [], [])).toEqual([]);
    expect(buildPanel(kit, store.state, [{ id: 'el_nothere' }], [])).toEqual(
      [],
    );
    const a = create('cls_task');
    const other = loadKit('er-lite');
    expect(buildPanel(other, store.state, [{ id: a }], [])).toEqual([]);
  });
});

describe('buildPanel controls and sections', () => {
  const attrs: AttributeDef[] = [
    { id: 'att_a', key: 'A', type: 'text', multiline: true },
    { id: 'att_b', key: 'B', type: 'integer', group: 'Numbers' },
    {
      id: 'att_c',
      key: 'C',
      type: 'number',
      unit: 'h',
      decimals: 2,
      group: 'Numbers',
    },
    { id: 'att_d', key: 'D', type: 'boolean', display: 'checkbox' },
    { id: 'att_e', key: 'E', type: 'date-time', group: 'Dates' },
    {
      id: 'att_f',
      key: 'F',
      type: 'choice',
      options: ['a', 'b', 'c', 'd', 'e'],
      help: { en: 'Pick one' },
    },
    {
      id: 'att_g',
      key: 'G',
      type: 'choice',
      options: [{ value: 'x', labels: { en: 'Ex', de: 'Iks' } }],
    },
    { id: 'att_h', key: 'H', type: 'boolean' },
  ];
  const kit = loadKit('bpmn-lite');
  const custom: Kit = {
    ...kit,
    classes: {
      ...kit.classes,
      cls_task: { ...kit.classes['cls_task']!, attributes: attrs },
    },
  };

  it('chooses controls and groups sections in first-appearance order', () => {
    const { store, create } = makeStore('bpmn-lite');
    const el = create('cls_task');
    const sections = buildPanel(custom, store.state, [{ id: el }], []);
    expect(sections.map((s) => s.title)).toEqual([
      undefined,
      'Numbers',
      'Dates',
    ]);
    expect(sections[1]!.fields.map((f) => f.attr.key)).toEqual(['B', 'C']);
    // Inherited attributes come first; ungrouped ones stay in the first section.
    expect(sections[0]!.fields.map((f) => f.attr.key)).toEqual([
      'Name',
      'Description',
      'A',
      'D',
      'F',
      'G',
      'H',
    ]);
    const f = sections.flatMap((s) => s.fields);
    expect(
      Object.fromEntries(f.map((x) => [x.attr.key, x.control])),
    ).toMatchObject({
      A: 'textarea',
      B: 'integer',
      C: 'number',
      D: 'checkbox',
      E: 'date-time',
      F: 'select',
      G: 'segmented',
      H: 'switch',
    });
    expect(byKey(f, 'C')).toMatchObject({
      unit: 'h',
      decimals: 2,
      group: 'Numbers',
    });
    expect(byKey(f, 'F').help).toBe('Pick one');
    expect(byKey(f, 'G').options).toEqual([{ value: 'x', label: 'Ex' }]);
  });

  it('labels options in the language', () => {
    const { store, create } = makeStore('bpmn-lite');
    const el = create('cls_task');
    const f = fieldsOf(buildPanel(custom, store.state, [{ id: el }], [], 'de'));
    expect(byKey(f, 'G').options).toEqual([{ value: 'x', label: 'Iks' }]);
  });
});
