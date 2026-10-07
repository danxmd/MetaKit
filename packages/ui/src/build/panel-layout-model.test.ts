import { describe, expect, it } from 'vitest';
import type { AttributeDef, PanelLayout } from '@metakit-app/core';
import { PanelLayoutModel, defaultLayout } from './panel-layout-model';

const defs: AttributeDef[] = [
  { id: 'att_a', key: 'Name', type: 'text' },
  { id: 'att_b', key: 'Owner', type: 'text', group: 'People' },
  { id: 'att_c', key: 'Reviewer', type: 'text', group: 'People' },
  {
    id: 'att_d',
    key: 'Priority',
    type: 'choice',
    options: ['Low', 'High'],
  },
  { id: 'att_e', key: 'Effort', type: 'number', group: 'Cost' },
  {
    id: 'att_f',
    key: 'Steps',
    type: 'table',
    columns: [],
  } as unknown as AttributeDef,
];

const model = () => new PanelLayoutModel(defaultLayout('cls_t', defs), defs);
const keys = (m: PanelLayoutModel): unknown[][] =>
  m
    .toLayout()
    .tabs.map((t) =>
      t.items.map((i) =>
        'group' in i
          ? [i.group, i.items.map((x) => 'attribute' in x && x.attribute)]
          : (i as { attribute: string }).attribute,
      ),
    );

describe('defaultLayout', () => {
  it('has one General tab with all attributes in order, grouped by attribute group', () => {
    expect(defaultLayout('cls_t', defs)).toEqual({
      class: 'cls_t',
      tabs: [
        {
          label: 'General',
          items: [
            { attribute: 'Name' },
            {
              group: 'People',
              items: [{ attribute: 'Owner' }, { attribute: 'Reviewer' }],
            },
            { attribute: 'Priority' },
            { group: 'Cost', items: [{ attribute: 'Effort' }] },
            { attribute: 'Steps' },
          ],
        },
      ],
    });
  });
});

describe('PanelLayoutModel', () => {
  it('reports unplaced attributes and places them', () => {
    const m = new PanelLayoutModel(
      {
        class: 'cls_t',
        tabs: [{ label: 'A', items: [{ attribute: 'Name' }] }],
      },
      defs,
    );
    expect(m.unplaced()).toEqual([
      'Owner',
      'Reviewer',
      'Priority',
      'Effort',
      'Steps',
    ]);
    m.addAttribute([0], 'Priority');
    const g = m.addGroup(0, 'Who');
    expect(g).toEqual([0, 2]);
    m.addAttribute(g, 'Owner');
    expect(keys(m)).toEqual([['Name', 'Priority', ['Who', ['Owner']]]]);
    expect(m.unplaced()).toEqual(['Reviewer', 'Effort', 'Steps']);
    expect(() => m.addAttribute([0], 'Owner')).toThrow(/already/);
    expect(() => m.addAttribute([0], 'Nope')).toThrow(/no attribute/);
  });

  it('adds, renames, moves and removes tabs', () => {
    const m = model();
    expect(m.addTab('Effort')).toBe(1);
    m.addTab();
    m.renameTab(2, '  Notes ');
    m.moveTab(2, 0);
    expect(m.toLayout().tabs.map((t) => t.label)).toEqual([
      'Notes',
      'General',
      'Effort',
    ]);
    m.removeTab(1);
    expect(m.toLayout().tabs.map((t) => t.label)).toEqual(['Notes', 'Effort']);
    // The removed tab's attributes are unplaced again, never lost.
    expect(m.unplaced()).toContain('Name');
    expect(() => m.renameTab(0, ' ')).toThrow(/needs a name/);
    expect(() => m.removeTab(9)).toThrow(/no tab/);
  });

  it('renames a group and removes it while keeping its attributes', () => {
    const m = model();
    m.renameGroup([0, 1], 'Responsibility');
    m.removeGroup([0, 1]);
    expect(keys(m)).toEqual([
      ['Name', 'Owner', 'Reviewer', 'Priority', ['Cost', ['Effort']], 'Steps'],
    ]);
  });

  it('moves items up, down, into a group and out of a group', () => {
    const m = model();
    expect(m.moveUp([0, 0])).toBe(false);
    expect(m.moveDown([0, 0])).toBe(true);
    expect(keys(m)).toEqual([
      [
        ['People', ['Owner', 'Reviewer']],
        'Name',
        'Priority',
        ['Cost', ['Effort']],
        'Steps',
      ],
    ]);
    // Name is now below People: into the group above.
    expect(m.intoGroup([0, 1])).toBe(true);
    expect(keys(m)).toEqual([
      [
        ['People', ['Owner', 'Reviewer', 'Name']],
        'Priority',
        ['Cost', ['Effort']],
        'Steps',
      ],
    ]);
    // Priority has a group above (People): goes there, not into Cost.
    expect(m.intoGroup([0, 1])).toBe(true);
    expect(keys(m)).toEqual([
      [
        ['People', ['Owner', 'Reviewer', 'Name', 'Priority']],
        ['Cost', ['Effort']],
        'Steps',
      ],
    ]);
    expect(m.outOfGroup([0, 0, 3])).toBe(true);
    expect(keys(m)).toEqual([
      [
        ['People', ['Owner', 'Reviewer', 'Name']],
        'Priority',
        ['Cost', ['Effort']],
        'Steps',
      ],
    ]);
    // Steps has Cost above it, so Steps goes in there; Priority sits between groups and goes up.
    expect(m.intoGroup([0, 3])).toBe(true);
    expect(keys(m)).toEqual([
      [
        ['People', ['Owner', 'Reviewer', 'Name']],
        'Priority',
        ['Cost', ['Effort', 'Steps']],
      ],
    ]);
    expect(m.outOfGroup([0, 1])).toBe(false);
    expect(m.moveDown([0, 2])).toBe(false);
  });

  it('moves an item to another tab and refuses nested groups', () => {
    const m = model();
    m.addTab('Two');
    m.moveItem([0, 0], [1, 0]);
    expect(keys(m)[1]).toEqual(['Name']);
    expect(() => m.moveItem([0, 0], [0, 1, 0])).toThrow(/inside another group/);
    expect(() => m.moveItem([0, 1], [0, 0, 5])).toThrow();
    // A failed move changes nothing.
    expect(keys(m)[1]).toEqual(['Name']);
  });

  it('removes an attribute', () => {
    const m = model();
    m.removeAttribute([0, 1, 0]);
    m.removeAttribute([0, 0]);
    expect(m.unplaced()).toEqual(['Name', 'Owner']);
    expect(() => m.removeAttribute([0, 99])).toThrow();
    // Index 0 is now the People group, which is not an attribute.
    expect(() => m.removeAttribute([0, 0])).toThrow(/no attribute/);
  });

  it('sets controls only when they suit the type', () => {
    const m = model();
    m.setControl([0, 2], 'select');
    expect((m.get([0, 2]) as { control?: string }).control).toBe('select');
    expect(() => m.setControl([0, 2], 'table')).toThrow(/does not suit/);
    m.setControl([0, 2], undefined);
    expect(m.get([0, 2])).toEqual({ attribute: 'Priority' });
    expect(() => m.setControl([0, 1], 'text')).toThrow(/no attribute/);
  });

  it('sets fixed and formula conditions', () => {
    const m = model();
    m.setCondition([0, 0], 'readOnly', true);
    m.setCondition([0, 0], 'required', '= Owner == null');
    m.setCondition([0, 0], 'visible', false);
    expect(m.get([0, 0])).toEqual({
      attribute: 'Name',
      readOnly: true,
      required: '= Owner == null',
      visible: false,
    });
    m.setCondition([0, 0], 'visible', undefined);
    expect(m.get([0, 0])).not.toHaveProperty('visible');
    m.setCondition([0], 'visible', "= TaskType != 'Manual'");
    m.setCondition([0, 1], 'visible', false);
    expect(m.get([0])).toMatchObject({ visible: "= TaskType != 'Manual'" });
    expect(() => m.setCondition([0, 0], 'visible', 'yes')).toThrow(/formula/);
    expect(() => m.setCondition([0], 'readOnly', true)).toThrow(/only have/);
    expect(() => m.setCondition([0, 1], 'required', true)).toThrow(/only have/);
  });

  it('sets heights and show relations', () => {
    const m = model();
    m.setHeight([0, 4], 200.4);
    expect(m.get([0, 4])).toEqual({ attribute: 'Steps', height: 200 });
    expect(() => m.setHeight([0, 4], 0)).toThrow(/above 0/);
    m.setHeight([0, 4], undefined);
    expect(m.get([0, 4])).toEqual({ attribute: 'Steps' });
    expect(m.toggleShowRelations()).toBe(true);
    expect(m.toLayout().showRelations).toBe(true);
    expect(m.toggleShowRelations()).toBe(false);
    expect(m.toLayout()).not.toHaveProperty('showRelations');
  });

  it('undoes and redoes, and a new edit clears redo', () => {
    const m = model();
    const start = m.toLayout();
    m.addTab('X');
    m.renameTab(1, 'Y');
    expect(m.undo()).toBe(true);
    expect(m.toLayout().tabs[1]!.label).toBe('X');
    expect(m.redo()).toBe(true);
    expect(m.toLayout().tabs[1]!.label).toBe('Y');
    m.undo();
    m.addTab('Z');
    expect(m.canRedo()).toBe(false);
    m.undo();
    m.undo();
    expect(m.toLayout()).toEqual(start);
    expect(m.undo()).toBe(false);
  });

  it('notifies listeners on changes, undo and redo but not on no-ops or failures', () => {
    const m = model();
    const seen: PanelLayout[] = [];
    const stop = m.onChange((l) => seen.push(l));
    m.addTab('X');
    m.renameTab(1, 'X');
    expect(() => m.removeTab(9)).toThrow();
    m.undo();
    m.redo();
    expect(seen).toHaveLength(3);
    stop();
    m.addTab('Q');
    expect(seen).toHaveLength(3);
  });

  it('returns copies, so callers cannot change the draft', () => {
    const m = model();
    const copy = m.toLayout();
    copy.tabs.length = 0;
    expect(m.toLayout().tabs).toHaveLength(1);
  });
});
