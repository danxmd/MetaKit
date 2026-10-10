import type { KitId } from '@metakit-app/core';
import {
  choice,
  date,
  formula,
  long,
  look,
  num,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * OKRs and goals: goals, periods that hold objectives, objectives that hold their key results
 * (start, target and current value give the progress), initiatives that move key results and the
 * people who own them. Colours show whether each is on track.
 */

const STATUS = (progress: string) =>
  `${progress} == null ? null : (${progress} >= 70 ? 'On track' : (${progress} >= 40 ? 'At risk' : 'Off track'))`;
const STATUS_TONE = {
  'On track': '#b2f2bb',
  'At risk': '#ffec99',
  'Off track': '#ffc9c9',
};

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
  extra: Partial<SampleElement> = {},
): SampleElement => ({ id, class: cls, x, y, attributes, ...extra });
const c = (relation: string, from: string, to: string): SampleConnector => ({
  relation,
  from,
  to,
});

// The sample: three objectives side by side in one period, their key results stacked inside.
const OBJ_X = (i: number) => 60 + i * 270;
const OBJ_Y = 200;
const objective = (
  i: number,
  id: string,
  attributes: SampleElement['attributes'],
) =>
  e(id, 'Objective', OBJ_X(i), OBJ_Y, attributes, {
    w: 250,
    h: 430,
    parent: 'period',
  });
const keyResult = (
  i: number,
  row: number,
  id: string,
  attributes: SampleElement['attributes'],
) =>
  e(id, 'KeyResult', OBJ_X(i) + 20, OBJ_Y + 44 + row * 124, attributes, {
    parent: `o_${i + 1}`,
  });

export const okrsGoals: KitSpec = {
  folder: 'okrs-goals',
  id: 'kit_okrs' as KitId,
  name: 'OKRs and goals',
  catalog: { keys: ['Goal', 'Initiative', 'Person'] },
  classes: [
    {
      key: 'Period',
      label: 'Period',
      help: 'A stretch of time for a set of OKRs, such as a quarter or a half year. Place its objectives inside it.',
      kind: 'container',
      look: look('container', {
        // See-through, so links to the objectives and key results inside stay visible.
        fill: '#f8f9fa66',
        border: '#495057',
        title: 'Heading',
        width: 830,
        height: 500,
      }),
      attributes: [
        date('Start'),
        date('End'),
        formula(
          'Objectives',
          'count(children())',
          'number',
          'How many objectives sit inside.',
        ),
        formula(
          'Progress',
          'IFERROR(round(avg(children().Progress), 0), null)',
          'number',
          'The average progress of the objectives inside, in percent.',
          { label: 'Progress (%)' },
        ),
        formula(
          'Heading',
          "Name + (Progress == null ? '' : ', ' + Progress + '%')",
          'text',
          'The name and the progress, shown as the heading.',
        ),
      ],
    },
    {
      key: 'Objective',
      label: 'Objective',
      help: 'What you want to achieve in the period, in words that inspire. Place its key results inside it.',
      kind: 'container',
      look: look('container', {
        fill: {
          by: 'Status',
          values: Object.fromEntries(
            Object.entries(STATUS_TONE).map(([k, v]) => [k, `${v}55`]),
          ),
          fallback: '#f1f3f555',
        },
        border: '#2f9e44',
        borderWidth: 2,
        title: 'Heading',
        width: 250,
        height: 430,
      }),
      attributes: [
        long('Description'),
        choice('Ambition', ['Committed', 'Aspirational'], {
          help: 'Committed: expected to be met in full. Aspirational: a stretch, where 70% is a good result.',
        }),
        formula(
          'Owner',
          "join(incoming('Owns').Name, ', ')",
          'text',
          'The people with an "Owns" connector to it.',
        ),
        formula(
          'KeyResults',
          'count(children())',
          'number',
          'How many key results sit inside.',
        ),
        formula(
          'Progress',
          'IFERROR(round(avg(children().Progress), 0), null)',
          'number',
          'The average progress of its key results, in percent.',
          { label: 'Progress (%)' },
        ),
        formula(
          'Status',
          STATUS('Progress'),
          'text',
          'On track from 70%, At risk from 40%, otherwise Off track. The fill shows it.',
        ),
        formula(
          'Heading',
          "Name + (Progress == null ? '' : ', ' + Progress + '%')",
          'text',
          'The name and the progress, shown as the heading.',
        ),
      ],
      constraints: [
        {
          id: 'k_objective_few',
          formula: 'KeyResults >= 2',
          message:
            "= 'Objective \"' + Name + '\" has fewer than two key results.'",
        },
        {
          id: 'k_objective_many',
          formula: 'KeyResults <= 5',
          message:
            "= 'Objective \"' + Name + '\" has more than five key results; keep the focus.'",
        },
        {
          id: 'k_objective_owner',
          formula: "count(incoming('Owns')) > 0",
          message: "= 'Objective \"' + Name + '\" has no owner.'",
        },
        {
          id: 'k_objective_aligned',
          formula: "count(outgoing('ContributesTo')) > 0",
          message:
            '= \'Objective "\' + Name + \'" is not aligned: connect it to a goal or a higher objective with "Contributes to".\'',
        },
      ],
    },
    {
      key: 'KeyResult',
      label: 'Key result',
      help: 'A measurable result that shows the objective is met, from a start value to a target. Progress follows the current value.',
      look: look('header-box', {
        fill: { by: 'Status', values: STATUS_TONE, fallback: '#e9ecef' },
        border: '#2f9e44',
        fields: ['Reading', 'Progress', 'Confidence'],
        width: 210,
      }),
      attributes: [
        text('Unit'),
        num('StartValue', { help: 'The value at the start of the period.' }),
        num('Target'),
        num('Current'),
        choice('Confidence', ['Low', 'Medium', 'High'], {
          help: 'How sure the owner is that the target will be reached.',
        }),
        formula(
          'Progress',
          'IFERROR(Current == null || StartValue == null || Target == null ? null : round(max(0, min(100, (Current - StartValue) / (Target - StartValue) * 100)), 0), null)',
          'number',
          'How far the current value has come from the start towards the target, from 0 to 100%. Works for targets below the start too.',
          { label: 'Progress (%)' },
        ),
        formula(
          'Status',
          STATUS('Progress'),
          'text',
          'On track from 70%, At risk from 40%, otherwise Off track. The fill shows it.',
        ),
        formula(
          'Reading',
          "(Current == null ? '-' : text(Current)) + ' of ' + (Target == null ? '-' : text(Target)) + (Unit ? ' ' + Unit : '')",
          'text',
          'The current value and the target, shown on the diagram.',
        ),
      ],
      constraints: [
        {
          id: 'k_kr_objective',
          formula: 'parent != null',
          message:
            "= 'Key result \"' + Name + '\" is not inside an objective.'",
        },
        {
          id: 'k_kr_target',
          formula: 'Target != null && StartValue != Target',
          message:
            "= 'Key result \"' + Name + '\" needs a target that differs from its start value.'",
        },
      ],
    },
  ],
  amend: {
    Goal: {
      look: look('hexagon', {
        fill: '#b2f2bb',
        border: '#2f9e44',
        icon: 'star',
        subtitle: 'Horizon',
        width: 220,
        height: 80,
      }),
    },
    Initiative: {
      help: 'A project or piece of work that should move one or more key results.',
      constraints: [
        {
          id: 'k_initiative_contributes',
          formula: "count(outgoing('ContributesTo')) > 0",
          message:
            '= \'Initiative "\' + Name + \'" moves no key result: connect it with "Contributes to".\'',
        },
      ],
    },
  },
  amendRelations: {
    ContributesTo: { from: ['Objective'], to: ['Objective', 'KeyResult'] },
    Owns: { to: ['Objective', 'KeyResult', 'Initiative'], replace: true },
  },
  modelTypes: [
    {
      key: 'OKRs',
      label: 'OKRs',
      help: 'Goals, periods with objectives and their key results, the initiatives that move them and the people who own them.',
      views: [
        {
          key: 'Objectives',
          label: 'Objectives',
          classes: ['Goal', 'Period', 'Objective', 'KeyResult'],
          relations: ['ContributesTo'],
        },
        {
          key: 'Delivery',
          label: 'Delivery',
          classes: ['Objective', 'KeyResult', 'Initiative', 'Person'],
          relations: ['ContributesTo', 'Owns'],
        },
      ],
      containers: { Period: ['Objective'], Objective: ['KeyResult'] },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        formula(
          'OverallProgress',
          "IFERROR(round(avg(objects('Objective').Progress), 0), null)",
          'number',
          'The average progress of all objectives, in percent.',
          { label: 'Overall progress (%)' },
        ),
        formula(
          'KeyResults',
          "count(objects('KeyResult'))",
          'number',
          'How many key results there are.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'KeyResult',
      tabs: [
        {
          label: 'Key result',
          items: [
            'Name',
            'Unit',
            'StartValue',
            'Target',
            'Current',
            'Progress',
            'Status',
            { attribute: 'Confidence', control: 'segmented' },
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Objective',
      tabs: [
        {
          label: 'Objective',
          items: [
            'Name',
            { attribute: 'Description', control: 'textarea' },
            { attribute: 'Ambition', control: 'segmented' },
            'Owner',
            'KeyResults',
            'Progress',
            'Status',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  rules: [
    {
      id: 'rule_krtarget',
      label: 'Say so when a key result reaches its target',
      when: {
        event: 'attribute.changed',
        class: 'KeyResult',
        attribute: 'Current',
      },
      if: '= Progress == 100',
      then: [
        {
          action: 'message',
          kind: 'info',
          text: "= 'Key result \"' + Name + '\" has reached its target: ' + Reading + '.'",
        },
      ],
    },
  ],
  sample: {
    file: 'library-okrs.mkmodel.json',
    id: 'mdl_libraryokrs',
    name: 'Library OKRs, first half of 2027',
    modelType: 'OKRs',
    attributes: {
      Title: 'Library OKRs, first half of 2027',
      Organisation: 'A city library service',
    },
    // "Run a greener service" has only one key result, on purpose.
    intendedWarnings: 1,
    elements: [
      e('g_people', 'Goal', 170, 40, {
        Name: 'A library everyone uses',
        Horizon: 'Long term',
        Measure: 'Share of residents who are members',
      }),
      e('g_green', 'Goal', 600, 40, {
        Name: 'Net zero by 2035',
        Horizon: 'Long term',
        Measure: 'Greenhouse gas emissions',
      }),
      e(
        'period',
        'Period',
        40,
        160,
        { Name: 'First half of 2027', Start: '2027-01-01', End: '2027-06-30' },
        { w: 830, h: 490 },
      ),
      objective(0, 'o_1', {
        Name: 'More people visit',
        Ambition: 'Committed',
      }),
      objective(1, 'o_2', {
        Name: 'Make digital lending easy',
        Ambition: 'Aspirational',
      }),
      objective(2, 'o_3', {
        Name: 'Run a greener service',
        Ambition: 'Committed',
      }),
      keyResult(0, 0, 'kr_members', {
        Name: 'New members',
        Unit: 'members',
        StartValue: 0,
        Target: 3000,
        Current: 2100,
        Confidence: 'High',
      }),
      keyResult(0, 1, 'kr_visits', {
        Name: 'Visits per week',
        Unit: 'visits',
        StartValue: 9000,
        Target: 11000,
        Current: 9800,
        Confidence: 'Medium',
      }),
      keyResult(0, 2, 'kr_events', {
        Name: 'Events with 20 or more guests',
        Unit: 'events',
        StartValue: 4,
        Target: 12,
        Current: 10,
        Confidence: 'High',
      }),
      keyResult(1, 0, 'kr_ebooks', {
        Name: 'E-book loans per month',
        Unit: 'loans',
        StartValue: 5000,
        Target: 9000,
        Current: 8200,
        Confidence: 'High',
      }),
      keyResult(1, 1, 'kr_rating', {
        Name: 'App rating',
        Unit: 'stars',
        StartValue: 3.1,
        Target: 4.2,
        Current: 3.9,
        Confidence: 'Medium',
      }),
      keyResult(2, 0, 'kr_energy', {
        Name: 'Energy use per year',
        Unit: 'MWh',
        StartValue: 420,
        Target: 360,
        Current: 405,
        Confidence: 'Low',
      }),
      e('i_events', 'Initiative', OBJ_X(0) + 95, 690, {
        Name: 'Weekend events',
        Sponsor: 'Head of libraries',
        Budget: 40000,
        Status: 'In progress',
        Start: '2027-01-15',
        End: '2027-06-30',
      }),
      e('i_app', 'Initiative', OBJ_X(1) + 95, 690, {
        Name: 'New library app',
        Sponsor: 'Digital lead',
        Budget: 120000,
        Status: 'In progress',
        Start: '2026-10-01',
        End: '2027-05-31',
      }),
      e('i_lighting', 'Initiative', OBJ_X(2) + 95, 690, {
        Name: 'LED lighting in all branches',
        Sponsor: 'Facilities manager',
        Budget: 85000,
        Status: 'Approved',
        Start: '2027-04-01',
        End: '2027-09-30',
      }),
      e('p_maya', 'Person', OBJ_X(0), 690, {
        Name: 'Maya Okafor',
        Role: 'Head of libraries',
      }),
      e('p_tom', 'Person', OBJ_X(1), 690, {
        Name: 'Tom Lindgren',
        Role: 'Digital lead',
      }),
      e('p_ines', 'Person', OBJ_X(2), 690, {
        Name: 'Ines Duarte',
        Role: 'Facilities manager',
      }),
    ],
    connectors: [
      c('ContributesTo', 'o_1', 'g_people'),
      c('ContributesTo', 'o_2', 'g_people'),
      c('ContributesTo', 'o_3', 'g_green'),
      c('ContributesTo', 'i_events', 'kr_events'),
      c('ContributesTo', 'i_app', 'kr_rating'),
      c('ContributesTo', 'i_app', 'kr_ebooks'),
      c('ContributesTo', 'i_lighting', 'kr_energy'),
      c('Owns', 'p_maya', 'o_1'),
      c('Owns', 'p_tom', 'o_2'),
      c('Owns', 'p_ines', 'o_3'),
    ],
  },
};
