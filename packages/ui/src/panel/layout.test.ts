import { describe, expect, it } from 'vitest';
import type { AttributeDef, PanelLayout } from '@metakit-app/core';
import {
  buildLayoutPanel,
  buildLayoutPanelFor,
  controlsFor,
  type LayoutNode,
  type LayoutPanel,
} from './layout';
import { makeStore } from './testing';

const defs: AttributeDef[] = [
  { id: 'att_name', key: 'Name', type: 'text', required: true },
  {
    id: 'att_prio',
    key: 'Priority',
    type: 'choice',
    options: ['Low', 'Medium', 'High'],
  },
  { id: 'att_owner', key: 'Owner', type: 'text' },
  {
    id: 'att_status',
    key: 'Status',
    type: 'choice',
    options: ['Open', 'Done', 'Blocked', 'Waiting', 'Late'],
  },
  {
    id: 'att_type',
    key: 'TaskType',
    type: 'choice',
    options: ['Manual', 'Auto'],
  },
  { id: 'att_effort', key: 'Effort', type: 'number' },
  { id: 'att_cost', key: 'Cost', type: 'number' },
  {
    id: 'att_steps',
    key: 'Steps',
    type: 'table',
    columns: [{ id: 'col_a', key: 'Step', type: 'text' }],
  } as AttributeDef,
  { id: 'att_notes', key: 'Notes', type: 'text', multiline: true },
];

// The complete task layout of the plan.
const taskLayout: PanelLayout = {
  class: 'cls_task',
  tabs: [
    {
      label: 'General',
      items: [
        { attribute: 'Name' },
        { attribute: 'Priority', control: 'segmented' },
        {
          group: 'Responsibility',
          items: [
            { attribute: 'Owner' },
            { attribute: 'Status', readOnly: '= Owner == null' },
          ],
        },
      ],
    },
    {
      label: 'Effort',
      visible: "= TaskType != 'Manual'",
      items: [
        { attribute: 'Effort' },
        { attribute: 'Cost' },
        { attribute: 'Steps', control: 'table', height: 200 },
      ],
    },
  ],
  showRelations: true,
};

const fieldsIn = (items: LayoutNode[]): string[] =>
  items.flatMap((n) =>
    n.kind === 'field' ? [n.field.attr.key] : fieldsIn(n.items),
  );
const find = (panel: LayoutPanel, key: string) => {
  const walk = (items: LayoutNode[]): LayoutNode | undefined => {
    for (const n of items) {
      if (n.kind === 'field' && n.field.attr.key === key) return n;
      if (n.kind === 'group') {
        const r = walk(n.items);
        if (r) return r;
      }
    }
    return undefined;
  };
  for (const t of panel.tabs) {
    const r = walk(t.items);
    if (r?.kind === 'field') return r;
  }
  throw new Error(`no field ${key}`);
};

describe('buildLayoutPanel', () => {
  it("builds the plan's task layout with tabs, a group and the More tab", () => {
    const panel = buildLayoutPanel(taskLayout, defs, {
      att_type: 'Auto',
    });
    expect(panel.tabs.map((t) => t.label)).toEqual([
      'General',
      'Effort',
      'More',
    ]);
    const general = panel.tabs[0]!;
    expect(general.items.map((n) => n.kind)).toEqual([
      'field',
      'field',
      'group',
    ]);
    const group = general.items[2]!;
    expect(group.kind === 'group' && group.label).toBe('Responsibility');
    expect(fieldsIn(general.items)).toEqual([
      'Name',
      'Priority',
      'Owner',
      'Status',
    ]);
    expect(find(panel, 'Priority').field.control).toBe('segmented');
    expect(find(panel, 'Steps')).toMatchObject({ height: 200 });
    expect(find(panel, 'Steps').field.control).toBe('table');
    expect(panel.showRelations).toBe(true);
    expect(panel.notes).toEqual([]);
  });

  it('places attributes the layout leaves out in a final tab, so nothing is unreachable', () => {
    const panel = buildLayoutPanel(taskLayout, defs, {});
    const more = panel.tabs.at(-1)!;
    expect(more).toMatchObject({ label: 'More', visible: true });
    expect(fieldsIn(more.items)).toEqual(['TaskType', 'Notes']);
    expect(find(panel, 'Notes').field.control).toBe('textarea');
  });

  it('has no More tab when everything is placed', () => {
    const only = defs.slice(0, 2);
    const panel = buildLayoutPanel(
      {
        class: 'cls_x',
        tabs: [
          {
            label: 'A',
            items: [{ attribute: 'Name' }, { attribute: 'Priority' }],
          },
        ],
      },
      only,
      {},
    );
    expect(panel.tabs.map((t) => t.label)).toEqual(['A']);
    expect(panel.showRelations).toBe(false);
  });

  it('evaluates conditions against the values and follows changes', () => {
    const empty = buildLayoutPanel(taskLayout, defs, {});
    expect(find(empty, 'Status').field.readOnly).toBe(true);
    const owned = buildLayoutPanel(taskLayout, defs, { att_owner: 'Ada' });
    expect(find(owned, 'Status').field.readOnly).toBe(false);
  });

  it('shows or hides a tab by formula', () => {
    const manual = buildLayoutPanel(taskLayout, defs, { att_type: 'Manual' });
    expect(manual.tabs.map((t) => t.visible)).toEqual([true, false, true]);
    const auto = buildLayoutPanel(taskLayout, defs, { att_type: 'Auto' });
    expect(auto.tabs[1]!.visible).toBe(true);
  });

  it('supports fixed booleans for visible, readOnly and required', () => {
    const panel = buildLayoutPanel(
      {
        class: 'cls_x',
        tabs: [
          {
            label: 'A',
            visible: true,
            items: [
              {
                attribute: 'Owner',
                visible: false,
                readOnly: true,
                required: true,
              },
              { group: 'G', visible: false, items: [{ attribute: 'Name' }] },
            ],
          },
        ],
      },
      defs,
      {},
    );
    expect(find(panel, 'Owner')).toMatchObject({
      visible: false,
      field: { readOnly: true, required: true },
    });
    const group = panel.tabs[0]!.items[1]!;
    expect(group.kind === 'group' && group.visible).toBe(false);
  });

  it('uses the defaults when a formula fails or returns nothing', () => {
    const panel = buildLayoutPanel(
      {
        class: 'cls_x',
        tabs: [
          {
            label: 'A',
            visible: '= Missing >',
            items: [
              { attribute: 'Owner', visible: '= 1 +', readOnly: '= Nothing' },
              { attribute: 'Effort', required: '= Cost' },
            ],
          },
        ],
      },
      defs,
      {},
    );
    expect(panel.tabs[0]!.visible).toBe(true);
    expect(find(panel, 'Owner')).toMatchObject({
      visible: true,
      field: { readOnly: false, required: false },
    });
    // Cost is unset, which is null, so the default applies.
    expect(find(panel, 'Effort').field.required).toBe(false);
    expect(panel.notes.some((n) => /could not be calculated/.test(n))).toBe(
      true,
    );
  });

  it('keeps calculated attributes and buttons read only', () => {
    const calc: AttributeDef[] = [
      { id: 'att_f', key: 'Total', type: 'formula', formula: '1' },
    ];
    const panel = buildLayoutPanel(
      {
        class: 'cls_x',
        tabs: [
          { label: 'A', items: [{ attribute: 'Total', readOnly: false }] },
        ],
      },
      calc,
      {},
    );
    expect(find(panel, 'Total').field.readOnly).toBe(true);
  });

  it('rejects a control that does not suit the attribute type and says why', () => {
    const panel = buildLayoutPanel(
      {
        class: 'cls_x',
        tabs: [
          {
            label: 'A',
            items: [
              { attribute: 'Priority', control: 'table' },
              { attribute: 'Effort', control: 'switch', height: 10 },
            ],
          },
        ],
      },
      defs,
      {},
    );
    expect(find(panel, 'Priority').field.control).toBe('segmented');
    expect(find(panel, 'Effort').field.control).toBe('number');
    expect(panel.notes).toHaveLength(3);
    expect(panel.notes[0]).toMatch(
      /Priority: the control "table" does not suit a choice attribute/,
    );
    expect(panel.notes[2]).toMatch(/height only applies/);
    expect(find(panel, 'Effort').height).toBeUndefined();
  });

  it('skips unknown and repeated attributes with a note', () => {
    const panel = buildLayoutPanel(
      {
        class: 'cls_x',
        tabs: [
          {
            label: 'A',
            items: [
              { attribute: 'Gone' },
              { attribute: 'Name' },
              { attribute: 'Name' },
            ],
          },
        ],
      },
      defs.slice(0, 1),
      {},
    );
    expect(fieldsIn(panel.tabs[0]!.items)).toEqual(['Name']);
    expect(panel.notes).toHaveLength(2);
  });

  it('shows differing values of several targets as mixed and issues as messages', () => {
    const panel = buildLayoutPanel(
      taskLayout,
      defs,
      { att_name: 'A' },
      {
        targets: [{ att_name: 'A' }, { att_name: 'B' }],
        issues: { att_name: ['Name is required.'] },
      },
    );
    expect(find(panel, 'Name').field).toMatchObject({
      mixed: true,
      value: undefined,
      issues: ['Name is required.'],
    });
  });

  it('uses labels for the language and offers only suitable controls', () => {
    const panel = buildLayoutPanel(
      {
        class: 'cls_x',
        tabs: [
          {
            label: 'General',
            labels: { de: 'Allgemein' },
            items: [{ group: 'G', labels: { de: 'Gruppe' }, items: [] }],
          },
        ],
      },
      [],
      {},
      { language: 'de' },
    );
    expect(panel.tabs[0]!.label).toBe('Allgemein');
    expect(controlsFor('choice')).toEqual(['select', 'segmented']);
    expect(controlsFor('formula')).toEqual([]);
  });
});

describe('buildLayoutPanelFor', () => {
  it('uses the layout of the tool for the selection and null without one', () => {
    const { tool, store, create } = makeStore('bpmn-lite');
    const a = create('cls_task', { att_name: 'A' } as never);
    const b = create('cls_task', { att_name: 'B' } as never);
    const gw = create('cls_gateway');
    expect(buildLayoutPanelFor(tool, store.state, [{ id: a }], [])).toBeNull();
    const layout: PanelLayout = {
      class: 'cls_task',
      tabs: [{ label: 'Main', items: [{ attribute: 'Name' }] }],
    };
    const withLayout = { ...tool, panels: { cls_task: layout } };
    const one = buildLayoutPanelFor(withLayout, store.state, [{ id: a }], []);
    expect(one!.tabs.map((t) => t.label)).toEqual(['Main', 'More']);
    const two = buildLayoutPanelFor(
      withLayout,
      store.state,
      [{ id: a }, { id: b }],
      [],
    );
    expect(find(two!, 'Name').field.mixed).toBe(true);
    expect(
      buildLayoutPanelFor(withLayout, store.state, [{ id: a }, { id: gw }], []),
    ).toBeNull();
  });
});
