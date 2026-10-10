import type { KitId } from '@metakit-app/core';
import {
  choice,
  date,
  formula,
  int,
  line,
  long,
  look,
  num,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Org chart: organisation units hold positions, positions hold the people who fill them, and
 * positions report to positions. Head count and vacancies add up from positions to units and to
 * the whole organisation.
 */

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
  extra: Partial<SampleElement> = {},
): SampleElement => ({ id, class: cls, x, y, attributes, ...extra });
const reports = (from: string, to: string): SampleConnector => ({
  relation: 'ReportsTo',
  from,
  to,
});

/** A position with the people inside it, one under the other. */
function position(
  id: string,
  unit: string,
  x: number,
  y: number,
  values: Record<string, string | number>,
  people: [string, string, Record<string, string | number>?][],
  w = 200,
): SampleElement[] {
  const seats = Math.max(1, Number(values['Seats'] ?? 1));
  return [
    e(id, 'Position', x, y, values, {
      parent: unit,
      w,
      h: 56 + seats * 44,
    }),
    ...people.map(([pid, name, more], i) =>
      e(
        pid,
        'Person',
        x + 15,
        y + 44 + i * 44,
        { Name: name, Employment: 'Permanent', FTE: 1, ...more },
        { parent: id, w: w - 30, h: 36 },
      ),
    ),
  ];
}

export const orgChart: KitSpec = {
  folder: 'org-chart',
  id: 'kit_orgchart' as KitId,
  name: 'Org chart',
  catalog: { keys: [] },
  classes: [
    {
      key: 'Unit',
      label: 'Organisation unit',
      help: 'A department, team or other part of the organisation. A lane for its positions and for the units inside it.',
      kind: 'swimlane',
      look: look('swimlane', {
        fill: '#e9ecef',
        border: '#868e96',
        width: 400,
        height: 360,
      }),
      attributes: [
        long('Description'),
        text('Code'),
        text('Location'),
        formula(
          'HeadCount',
          'sum(children().HeadCount)',
          'number',
          'The people in its positions and in the units inside it.',
          { label: 'Head count' },
        ),
        formula(
          'Vacancies',
          'sum(children().Vacancies)',
          'number',
          'The empty seats of its positions and of the units inside it.',
        ),
      ],
    },
    {
      key: 'Position',
      label: 'Position',
      help: 'A job in a unit, such as head of sales, with the number of people it is for. Place the people who fill it inside it.',
      look: look('container', {
        fill: {
          by: 'Vacant',
          values: { true: '#fff5f5', false: '#e7f5ff' },
          fallback: '#e7f5ff',
        },
        border: {
          by: 'Vacant',
          values: { true: '#e03131', false: '#1c7ed6' },
          fallback: '#1c7ed6',
        },
        title: 'Heading',
        width: 200,
        height: 100,
      }),
      attributes: [
        long('Description'),
        text('Grade'),
        int('Seats', {
          min: 1,
          default: 1,
          help: 'How many people the position is for, such as 2 for two developers.',
        }),
        formula(
          'HeadCount',
          'count(children())',
          'number',
          'How many people fill it.',
          { label: 'Head count' },
        ),
        formula(
          'Vacancies',
          'max(0, (Seats ?? 1) - HeadCount)',
          'number',
          'Seats that nobody fills yet.',
        ),
        formula(
          'Vacant',
          'HeadCount == 0',
          'boolean',
          'Yes when nobody fills it. It colours the position red.',
        ),
        formula(
          'Heading',
          "Name + (Vacancies > 0 ? ' · ' + Vacancies + ' vacant' : '')",
          'text',
          'The name and the number of empty seats, shown as the title.',
        ),
        formula(
          'Unit',
          'parent ? parent.Name : null',
          'text',
          'The unit it belongs to.',
        ),
      ],
      constraints: [
        {
          id: 'k_position_seats',
          formula: 'HeadCount <= (Seats ?? 1)',
          message:
            "= 'Position \"' + Name + '\" has ' + HeadCount + ' people for ' + (Seats ?? 1) + ' seats.'",
        },
        {
          id: 'k_position_reports',
          formula: "count(outgoing('ReportsTo')) <= 1",
          message:
            '= \'Position "\' + Name + \'" reports to more than one position: keep one "Reports to" and make the others "Dotted line to".\'',
        },
      ],
    },
    {
      key: 'Person',
      label: 'Person',
      help: 'Someone who works in the organisation. Place them inside the position they fill.',
      look: look('pill', {
        fill: '#ffffff',
        border: '#495057',
        icon: 'person',
        width: 170,
        height: 36,
      }),
      attributes: [
        text('Email'),
        date('StartDate'),
        choice('Employment', ['Permanent', 'Fixed term', 'Contractor']),
        num('FTE', {
          min: 0,
          max: 1,
          label: 'Working time (FTE)',
          help: '1 for full time, 0.5 for half time.',
        }),
      ],
      constraints: [
        {
          id: 'k_person_position',
          formula: 'parent != null',
          message:
            "= 'Person \"' + Name + '\" fills no position: place them inside one.'",
        },
      ],
    },
  ],
  relations: [
    {
      key: 'ReportsTo',
      label: 'Reports to',
      help: 'The position reports to its manager’s position.',
      from: ['Position'],
      to: ['Position'],
      look: line('#495057'),
    },
    {
      key: 'DottedLineTo',
      label: 'Dotted line to',
      help: 'A second, weaker reporting line, such as to a project lead.',
      from: ['Position'],
      to: ['Position'],
      look: line('#868e96', { style: 'dashed' }),
    },
  ],
  modelTypes: [
    {
      key: 'OrgChart',
      label: 'Org chart',
      help: 'Organisation units with their positions and the people in them, joined by reporting lines.',
      containers: { Unit: ['Unit', 'Position'], Position: ['Person'] },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        date('AsOf', { label: 'As of' }),
        formula(
          'HeadCount',
          "count(objects('Person'))",
          'number',
          'How many people the chart shows.',
          { label: 'Head count' },
        ),
        formula(
          'Vacancies',
          "sum(objects('Position').Vacancies)",
          'number',
          'The empty seats of all positions.',
        ),
        formula(
          'Positions',
          "count(objects('Position'))",
          'number',
          'How many positions the chart shows.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Position',
      tabs: [
        {
          label: 'Position',
          items: [
            'Name',
            { attribute: 'Description', control: 'textarea' },
            'Grade',
            'Unit',
          ],
        },
        {
          label: 'Seats',
          items: ['Seats', 'HeadCount', 'Vacancies', 'Vacant'],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'software-company.mkmodel.json',
    id: 'mdl_softwarecompany',
    name: 'Organisation 2027',
    modelType: 'OrgChart',
    attributes: {
      Title: 'Organisation 2027',
      Organisation: 'A small software company',
      AsOf: '2027-01-04',
    },
    intendedWarnings: 0,
    elements: [
      e(
        'u_mgmt',
        'Unit',
        450,
        20,
        { Name: 'Management', Code: 'M' },
        { w: 410, h: 160 },
      ),
      ...position(
        'pos_md',
        'u_mgmt',
        555,
        40,
        { Name: 'Managing director', Grade: 'Director' },
        [['p_alex', 'Alex Morgan']],
      ),
      e(
        'u_product',
        'Unit',
        20,
        240,
        { Name: 'Product', Code: 'P' },
        { w: 410, h: 340 },
      ),
      ...position(
        'pos_hprod',
        'u_product',
        145,
        260,
        { Name: 'Head of product', Grade: 'Head' },
        [['p_priya', 'Priya Shah']],
      ),
      ...position(
        'pos_dev',
        'u_product',
        60,
        410,
        { Name: 'Developer', Grade: 'Senior', Seats: 2 },
        [
          ['p_jonas', 'Jonas Berg'],
          ['p_mei', 'Mei Lin', { Employment: 'Contractor' }],
        ],
        180,
      ),
      ...position(
        'pos_designer',
        'u_product',
        245,
        410,
        { Name: 'Designer', Grade: 'Mid' },
        [],
        180,
      ),
      e(
        'u_ops',
        'Unit',
        450,
        240,
        { Name: 'Operations', Code: 'O' },
        { w: 410, h: 340 },
      ),
      ...position(
        'pos_hops',
        'u_ops',
        575,
        260,
        { Name: 'Head of operations', Grade: 'Head' },
        [['p_omar', 'Omar Haddad']],
      ),
      ...position(
        'pos_office',
        'u_ops',
        490,
        410,
        { Name: 'Office manager', Grade: 'Mid' },
        [['p_lena', 'Lena Novak', { FTE: 0.8 }]],
        180,
      ),
      ...position(
        'pos_finance',
        'u_ops',
        675,
        410,
        { Name: 'Finance officer', Grade: 'Mid' },
        [['p_chris', 'Chris Doyle', { Employment: 'Fixed term' }]],
        180,
      ),
      e(
        'u_sales',
        'Unit',
        880,
        240,
        { Name: 'Sales', Code: 'S' },
        { w: 410, h: 340 },
      ),
      ...position(
        'pos_hsales',
        'u_sales',
        1005,
        260,
        { Name: 'Head of sales', Grade: 'Head' },
        [],
      ),
      ...position(
        'pos_account',
        'u_sales',
        920,
        410,
        { Name: 'Account manager', Grade: 'Mid', Seats: 2 },
        [['p_ana', 'Ana Silva']],
        180,
      ),
      ...position(
        'pos_assistant',
        'u_sales',
        1105,
        410,
        { Name: 'Sales assistant', Grade: 'Junior' },
        [['p_sam', 'Sam Taylor', { FTE: 0.5 }]],
        180,
      ),
    ],
    connectors: [
      reports('pos_hprod', 'pos_md'),
      reports('pos_hops', 'pos_md'),
      reports('pos_hsales', 'pos_md'),
      reports('pos_dev', 'pos_hprod'),
      reports('pos_designer', 'pos_hprod'),
      reports('pos_office', 'pos_hops'),
      reports('pos_finance', 'pos_hops'),
      reports('pos_account', 'pos_hsales'),
      reports('pos_assistant', 'pos_hsales'),
    ],
  },
};
