import type { AttributeDef, ClassId, Model, Kit } from '@metakit-app/core';
import {
  SAMPLE,
  clone,
  emptySampleModel,
  sampleKit,
} from '@metakit-app/core/testing';
import { describe, expect, it } from 'vitest';
import { csvCell, exportCsv, exportCsvZip } from './csv';
import { unzipFiles } from './zip';

const extra: AttributeDef[] = [
  { id: 'att_done', key: 'Done', type: 'boolean' },
  {
    id: 'att_tags',
    key: 'Tags',
    type: 'multi-choice',
    options: ['a', 'b', 'c'],
  },
  {
    id: 'att_steps',
    key: 'Steps',
    type: 'table',
    columns: [
      { id: 'col_n', key: 'N', type: 'text' },
      { id: 'col_h', key: 'Hours', type: 'number' },
    ],
  },
  {
    id: 'att_owner',
    key: 'Owner',
    type: 'reference',
    target: {},
  },
  // A key that is also a fixed column.
  { id: 'att_id', key: 'id', type: 'text' },
];

function kit(): Kit {
  const t = clone(sampleKit());
  t.classes[SAMPLE.task as ClassId]!.attributes.push(...extra);
  return t;
}

function model(): Model {
  const m = clone(emptySampleModel());
  m.elements = {
    el_lane: {
      id: 'el_lane',
      class: SAMPLE.lane,
      x: 0,
      y: 0,
      w: 600,
      h: 200,
      attrs: { att_lanename: 'Sales' },
      pos: 'a',
    },
    el_a: {
      id: 'el_a',
      class: SAMPLE.task,
      x: 10,
      y: 20.5,
      w: 120,
      h: 60,
      parent: 'el_lane',
      attrs: {
        [SAMPLE.attName]: 'Check, "approve"\nand send',
        [SAMPLE.attPriority]: 'High',
        [SAMPLE.attEffort]: 2.5,
        [SAMPLE.attCost]: 999,
        att_done: true,
        att_tags: ['a', 'c'],
        att_steps: [
          { col_n: 'one', col_h: 1 },
          { col_n: 'two, "2"', col_h: 2 },
        ],
        att_owner: [{ element: 'el_b' }],
        att_id: 'x',
      },
      pos: 'b',
    },
    el_b: {
      id: 'el_b',
      class: SAMPLE.task,
      x: 300,
      y: 20,
      w: 120,
      h: 60,
      attrs: { [SAMPLE.attName]: 'Ünïcode' },
      pos: 'c',
    },
  } as unknown as Model['elements'];
  m.connectors = {
    cn_1: {
      id: 'cn_1',
      relation: SAMPLE.flow,
      from: 'el_a',
      to: 'el_b',
      bends: [],
      attrs: { [SAMPLE.attCondition]: 'yes' },
      pos: 'a',
    },
  } as unknown as Model['connectors'];
  return m;
}

describe('csvCell', () => {
  it('quotes only what needs it and doubles quotes', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell('cr\rhere')).toBe('"cr\rhere"');
    expect(csvCell('')).toBe('');
  });
});

describe('exportCsv', () => {
  it('writes one file per class that has objects, and one per relation class', () => {
    expect(Object.keys(exportCsv(kit(), model())).sort()).toEqual([
      'Lane.csv',
      'SequenceFlow.csv',
      'Task.csv',
    ]);
  });

  it('puts id, position, size and parent first, then the attributes in definition order, without formulas', () => {
    const task = exportCsv(kit(), model())['Task.csv']!;
    const header = task.split('\r\n')[0];
    expect(header).toBe(
      'id,x,y,w,h,parent_id,Name,Code,Priority,Effort,Done,Tags,Steps,Owner,attribute_id',
    );
    expect(header).not.toContain('Cost');
  });

  it('writes values by type with RFC 4180 quoting', () => {
    const task = exportCsv(kit(), model())['Task.csv']!;
    const lines = task.split('\r\n');
    expect(lines).toHaveLength(4); // header, two rows, and the empty end
    expect(task.endsWith('\r\n')).toBe(true);
    const row =
      'el_a,10,20.5,120,60,el_lane,"Check, ""approve""\nand send",,High,2.5,true,a;c,' +
      `"${JSON.stringify([
        { col_n: 'one', col_h: 1 },
        { col_n: 'two, "2"', col_h: 2 },
      ]).replace(/"/g, '""')}",el_b,x`;
    expect(task).toContain(row);
    expect(task).toContain('el_b,300,20,120,60,,Ünïcode,');
  });

  it('writes connectors with their ends', () => {
    expect(exportCsv(kit(), model())['SequenceFlow.csv']).toBe(
      'id,from_id,to_id,Condition\r\ncn_1,el_a,el_b,yes\r\n',
    );
  });

  it('can start with a byte order mark for Excel', () => {
    const files = exportCsv(kit(), model(), { bom: true });
    for (const text of Object.values(files))
      expect(text.startsWith('﻿')).toBe(true);
    expect(exportCsv(kit(), model())['Lane.csv']!.startsWith('﻿')).toBe(false);
  });

  it('gives a zip with the same files', () => {
    const files = unzipFiles(exportCsvZip(kit(), model(), { bom: true }));
    expect(Object.keys(files)).toEqual([
      'Lane.csv',
      'SequenceFlow.csv',
      'Task.csv',
    ]);
    expect(
      new TextDecoder('utf-8', { ignoreBOM: true }).decode(files['Lane.csv']!),
    ).toBe(exportCsv(kit(), model(), { bom: true })['Lane.csv']);
  });
});
