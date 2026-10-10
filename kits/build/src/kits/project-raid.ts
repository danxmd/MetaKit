import type { KitId } from '@metakit-app/core';
import {
  choice,
  date,
  formula,
  line,
  long,
  look,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Project delivery and RAID: a programme holds workstreams with their tasks, deliverables and
 * milestones; risks, assumptions, issues, dependencies and decisions (the RAID log) point to the
 * parts of the plan they affect.
 */

const RAG_BORDER = {
  by: 'Status',
  values: { Green: '#2f9e44', Amber: '#f08c00', Red: '#e03131' },
  fallback: '#f08c00',
};

const TASK_FILL = {
  by: 'Status',
  values: {
    'Not started': '#f8f9fa',
    'In progress': '#ffe8cc',
    Done: '#d3f9d8',
    Blocked: '#ffc9c9',
  },
  fallback: '#f8f9fa',
};

const MILESTONE_FILL = {
  by: 'State',
  values: {
    Reached: '#b2f2bb',
    Overdue: '#ffc9c9',
    'Due soon': '#ffec99',
    Planned: '#ffd8a8',
  },
  fallback: '#e9ecef',
};

/** Open and not done, with a date in the past. Dates are text such as 2027-06-14. */
const overdue = (done: string, due: string) =>
  formula(
    'Overdue',
    `!(${done}) && ${due} != null && ${due} < today()`,
    'boolean',
    `Yes when it is not done and its date has passed.`,
  );

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
  extra: Partial<SampleElement> = {},
): SampleElement => ({ id, class: cls, x, y, attributes, ...extra });
const c = (
  relation: string,
  from: string,
  to: string,
  attributes?: SampleConnector['attributes'],
): SampleConnector => ({
  relation,
  from,
  to,
  ...(attributes ? { attributes } : {}),
});

/** A workstream with three tasks, a deliverable and a milestone, laid out the same way. */
function workstream(
  id: string,
  x: number,
  values: Record<string, string>,
  tasks: [string, Record<string, string | number>][],
  deliverable: [string, Record<string, string>],
  milestone: [string, Record<string, string | boolean>],
): SampleElement[] {
  const at = [
    [x + 20, 120],
    [x + 220, 120],
    [x + 20, 220],
  ];
  return [
    e(id, 'Workstream', x, 70, values, { w: 420, h: 430, parent: 'prog' }),
    ...tasks.map(([tid, v], i) =>
      e(tid, 'Task', at[i]![0]!, at[i]![1]!, v, { w: 180, parent: id }),
    ),
    e(deliverable[0], 'Deliverable', x + 220, 210, deliverable[1], {
      w: 180,
      parent: id,
    }),
    e(milestone[0], 'Milestone', x + 110, 340, milestone[1], { parent: id }),
  ];
}

export const projectRaid: KitSpec = {
  folder: 'project-raid',
  id: 'kit_projectraid' as KitId,
  name: 'Project delivery and RAID',
  catalog: {
    keys: [
      'Workstream',
      'Task',
      'Deliverable',
      'Milestone',
      'Risk',
      'Assumption',
      'Issue',
      'Dependency',
      'Decision',
    ],
    generic: ['DependsOn'],
  },
  classes: [
    {
      key: 'Programme',
      label: 'Programme',
      help: 'A project or programme. Place its workstreams, and milestones that belong to the whole programme, inside it.',
      look: look('container', {
        fill: '#fff9db',
        border: RAG_BORDER,
        borderWidth: 2,
        title: 'Heading',
        width: 1340,
        height: 640,
      }),
      attributes: [
        long('Description'),
        text('Sponsor'),
        text('Manager'),
        date('Start'),
        date('End'),
        choice('Status', ['Green', 'Amber', 'Red'], {
          label: 'Status (red, amber, green)',
        }),
        formula(
          'Progress',
          'IFERROR(round(avg(children().Progress), 0), null)',
          'number',
          'The average progress of its workstreams, in percent.',
          { label: 'Progress (%)' },
        ),
        formula(
          'Heading',
          "Name + (Status ? ' · ' + Status : '') + (Progress == null ? '' : ' · ' + Progress + '% done')",
          'text',
          'The name, the status and the progress, shown as the title.',
        ),
      ],
      constraints: [
        {
          id: 'k_programme_dates',
          formula: 'Start == null || End == null || Start <= End',
          message: "= 'Programme \"' + Name + '\" ends before it starts.'",
        },
      ],
    },
  ],
  amend: {
    Workstream: {
      help: 'A part of the programme with its own lead and status. Place its tasks, deliverables and milestones inside it.',
      attributes: [
        formula(
          'Effort',
          'sum(children().Effort)',
          'number',
          'The effort of the tasks inside it, in hours.',
          { label: 'Effort (hours)' },
        ),
        formula(
          'Progress',
          'IFERROR(round(sum(children().EffortDone) / sum(children().Effort) * 100, 0), null)',
          'number',
          'The share of the effort of its tasks that is done, in percent.',
          { label: 'Progress (%)' },
        ),
        formula(
          'Heading',
          "Name + (Progress == null ? '' : ' · ' + Progress + '% done')",
          'text',
          'The name and the progress, shown as the title.',
        ),
      ],
      look: look('container', {
        fill: '#f8f9fa',
        border: RAG_BORDER,
        borderWidth: 2,
        title: 'Heading',
      }),
    },
    Task: {
      attributes: [
        formula(
          'EffortDone',
          "Status == 'Done' ? (Effort ?? 0) : 0",
          'number',
          'The effort when the task is done, otherwise 0. Workstreams add it up for their progress.',
          { label: 'Effort done (hours)' },
        ),
        overdue("Status == 'Done'", 'Due'),
      ],
      look: look('rounded', {
        fill: TASK_FILL,
        border: {
          by: 'Overdue',
          values: { true: '#e03131', false: '#f08c00' },
          fallback: '#f08c00',
        },
        subtitle: 'Owner',
      }),
    },
    Deliverable: {
      attributes: [text('Owner'), overdue("Status == 'Done'", 'Due')],
      look: look('document', {
        fill: TASK_FILL,
        border: {
          by: 'Overdue',
          values: { true: '#e03131', false: '#f08c00' },
          fallback: '#f08c00',
        },
        icon: 'document',
        subtitle: 'Due',
      }),
      constraints: [
        {
          id: 'k_deliverable_home',
          formula: "parent != null || count(incoming('Delivers')) > 0",
          message:
            '= \'Deliverable "\' + Name + \'" belongs to no workstream: place it in one, or connect a workstream or task to it with "Delivers".\'',
        },
      ],
    },
    Milestone: {
      attributes: [
        text('Owner'),
        formula(
          'State',
          "Reached ? 'Reached' : Date == null ? null : Date < today() ? 'Overdue' : daysBetween(today(), Date) <= 14 ? 'Due soon' : 'Planned'",
          'text',
          'Reached, Overdue (its date has passed and it is not reached), Due soon (within 14 days) or Planned. It colours the shape.',
        ),
        formula(
          'DaysLeft',
          'Reached || Date == null ? null : daysBetween(today(), Date)',
          'number',
          'Days from today to its date; below 0 when it is overdue.',
        ),
      ],
      look: look('diamond', {
        fill: MILESTONE_FILL,
        border: '#f08c00',
        icon: 'flag',
        subtitle: 'Date',
        width: 200,
        height: 120,
      }),
    },
    Risk: {
      attributes: [
        choice('Response', ['Avoid', 'Reduce', 'Transfer', 'Accept'], {
          help: 'What you do about it: avoid it, reduce it, pass it on, or accept it.',
        }),
        long('Mitigation', {
          help: 'What is done to make it less likely or less harmful.',
        }),
        date('ReviewBy'),
      ],
      look: look('header-box', {
        fill: {
          by: 'Rating',
          values: { Low: '#d3f9d8', Medium: '#fff3bf', High: '#ffc9c9' },
          fallback: '#e9ecef',
        },
        border: '#e03131',
        icon: 'warning',
        fields: ['Owner', 'Score', 'Rating'],
        width: 240,
      }),
      constraints: [
        {
          id: 'k_risk_high',
          formula:
            "Rating != 'High' || Status == 'Closed' || (!isEmpty(Owner) && (!isEmpty(Mitigation) || count(incoming('Addresses')) > 0))",
          message:
            "= 'High risk \"' + Name + '\" has ' + (isEmpty(Owner) ? 'no owner' : 'no mitigation') + ': ' + (isEmpty(Owner) ? 'give it an owner.' : 'describe the mitigation, or connect a task or decision to it with \"Addresses\".')",
        },
      ],
    },
    Assumption: {
      attributes: [text('Owner'), date('CheckBy')],
      look: look('pill', {
        fill: {
          by: 'Validated',
          values: { true: '#d3f9d8', false: '#fff4e6' },
          fallback: '#fff4e6',
        },
        border: '#f08c00',
        width: 200,
        height: 50,
      }),
    },
    Issue: {
      attributes: [long('Resolution')],
      look: look('header-box', {
        fill: {
          by: 'Severity',
          values: {
            Low: '#f8f9fa',
            Medium: '#fff3bf',
            High: '#ffd8a8',
            Critical: '#ffc9c9',
          },
          fallback: '#f8f9fa',
        },
        border: '#e8590c',
        icon: 'warning',
        fields: ['Owner', 'Severity', 'Status'],
        width: 240,
      }),
      constraints: [
        {
          id: 'k_issue_owner',
          formula:
            "Status == 'Resolved' || Status == 'Closed' || !isEmpty(Owner)",
          message:
            "= 'Issue \"' + Name + '\" is open and has no owner to resolve it.'",
        },
      ],
    },
    Dependency: {
      attributes: [
        text('Provider', { help: 'Who must deliver it.' }),
        overdue("Status == 'Delivered'", 'NeededBy'),
      ],
      look: look('pill', {
        fill: {
          by: 'Status',
          values: {
            Open: '#f8f9fa',
            Agreed: '#e7f5ff',
            Delivered: '#d3f9d8',
            'At risk': '#ffc9c9',
          },
          fallback: '#f8f9fa',
        },
        border: '#1c7ed6',
        subtitle: 'NeededBy',
        width: 210,
        height: 54,
      }),
    },
    Decision: {
      attributes: [text('DecidedBy')],
      look: look('header-box', {
        fill: {
          by: 'Status',
          values: {
            Proposed: '#fff4e6',
            Agreed: '#e5dbff',
            Superseded: '#e9ecef',
          },
          fallback: '#fff4e6',
        },
        border: '#6741d9',
        icon: 'check',
        fields: ['Status', 'Date'],
        width: 240,
      }),
      constraints: [
        {
          id: 'k_decision_rationale',
          formula: "Status != 'Agreed' || !isEmpty(Rationale)",
          message:
            "= 'Decision \"' + Name + '\" is agreed but has no rationale: write down why it was made.'",
        },
      ],
    },
  },
  relations: [
    {
      key: 'NeededFor',
      label: 'Needed for',
      help: 'The milestone is reached only once this task or deliverable is done.',
      from: ['Task', 'Deliverable'],
      to: ['Milestone'],
      look: line('#f08c00', { style: 'dashed' }),
    },
    {
      key: 'Affects',
      label: 'Affects',
      help: 'The risk, assumption, issue or dependency affects this part of the plan.',
      from: ['Risk', 'Assumption', 'Issue', 'Dependency'],
      to: ['Programme', 'Workstream', 'Task', 'Deliverable', 'Milestone'],
      look: line('#e03131', { style: 'dotted' }),
    },
    {
      key: 'Addresses',
      label: 'Addresses',
      help: 'The task mitigates the risk or resolves the issue, or the decision settles it.',
      from: ['Task', 'Decision'],
      to: ['Risk', 'Issue', 'Assumption'],
      look: line('#2f9e44', { end: 'bar' }),
    },
    {
      key: 'TurnedInto',
      label: 'Turned into',
      help: 'The risk happened and is now an issue.',
      from: ['Risk'],
      to: ['Issue'],
      look: line('#e03131', { style: 'dashed', end: 'triangle' }),
    },
  ],
  amendRelations: {
    Delivers: { from: ['Task'] },
    DependsOn: {
      replace: true,
      from: ['Task', 'Deliverable', 'Milestone', 'Workstream'],
      to: ['Task', 'Deliverable', 'Milestone', 'Workstream', 'Dependency'],
    },
  },
  modelTypes: [
    {
      key: 'Project',
      label: 'Project or programme',
      help: 'A programme with workstreams, tasks, deliverables and milestones, and its RAID log: risks, assumptions, issues, dependencies and decisions.',
      views: [
        {
          key: 'Plan',
          label: 'Plan',
          classes: [
            'Programme',
            'Workstream',
            'Task',
            'Deliverable',
            'Milestone',
          ],
          relations: ['Delivers', 'NeededFor', 'DependsOn'],
        },
        {
          key: 'RAID',
          label: 'RAID log',
          classes: [
            'Risk',
            'Assumption',
            'Issue',
            'Dependency',
            'Decision',
            'Task',
          ],
          relations: ['Affects', 'Addresses', 'TurnedInto'],
        },
      ],
      containers: {
        Programme: ['Workstream', 'Milestone'],
        Workstream: ['Task', 'Deliverable', 'Milestone'],
      },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        text('Manager'),
        formula(
          'TotalEffort',
          "sum(objects('Task').Effort)",
          'number',
          'The effort of all tasks, in hours.',
          { label: 'Total effort (hours)' },
        ),
        formula(
          'Progress',
          "IFERROR(round(sum(objects('Task').EffortDone) / sum(objects('Task').Effort) * 100, 0), null)",
          'number',
          'The share of the effort of all tasks that is done, in percent.',
          { label: 'Progress (%)' },
        ),
        formula(
          'RAIDItems',
          "count(objects('Risk')) + count(objects('Assumption')) + count(objects('Issue')) + count(objects('Dependency'))",
          'number',
          'How many risks, assumptions, issues and dependencies the log holds.',
          { label: 'RAID items' },
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Risk',
      tabs: [
        {
          label: 'Risk',
          items: [
            'Name',
            { attribute: 'Description', control: 'textarea' },
            'Owner',
            { attribute: 'Status', control: 'select' },
            'ReviewBy',
          ],
        },
        {
          label: 'Assessment',
          items: [
            'Likelihood',
            'Impact',
            'Score',
            'Rating',
            { attribute: 'Response', control: 'segmented' },
            { attribute: 'Mitigation', control: 'textarea' },
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Task',
      tabs: [
        {
          label: 'Task',
          items: [
            'Name',
            'Owner',
            { attribute: 'Status', control: 'select' },
            'Due',
            'Overdue',
            'Effort',
            'EffortDone',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'office-move.mkmodel.json',
    id: 'mdl_officemove',
    name: 'Head office move',
    modelType: 'Project',
    attributes: {
      Title: 'Head office move',
      Organisation: 'A mid-sized engineering firm',
      Manager: 'Programme manager',
    },
    // "New network not ready in time" is a high risk without a mitigation, on purpose.
    intendedWarnings: 1,
    elements: [
      e(
        'prog',
        'Programme',
        20,
        20,
        {
          Name: 'Head office move',
          Sponsor: 'Chief operating officer',
          Manager: 'Programme manager',
          Start: '2027-01-04',
          End: '2027-07-30',
          Status: 'Amber',
          Description:
            'Move 220 staff from the old head office to two floors of a new building.',
        },
        { w: 1340, h: 640 },
      ),
      ...workstream(
        'ws_property',
        40,
        {
          Name: 'Property and fit-out',
          Lead: 'Facilities manager',
          Status: 'Amber',
        },
        [
          [
            't_lease',
            {
              Name: 'Sign the lease',
              Owner: 'Finance director',
              Status: 'Done',
              Effort: 16,
              Due: '2027-01-29',
            },
          ],
          [
            't_design',
            {
              Name: 'Design the floor plan',
              Owner: 'Workplace designer',
              Status: 'Done',
              Effort: 60,
              Due: '2027-02-26',
            },
          ],
          [
            't_fitout',
            {
              Name: 'Fit out the new floors',
              Owner: 'Facilities manager',
              Status: 'In progress',
              Effort: 400,
              Due: '2027-05-28',
            },
          ],
        ],
        [
          'd_floors',
          {
            Name: 'Floors ready to use',
            Owner: 'Facilities manager',
            Status: 'In progress',
            Due: '2027-06-11',
          },
        ],
        [
          'm_handover',
          {
            Name: 'Building ready',
            Owner: 'Facilities manager',
            Date: '2027-06-14',
          },
        ],
      ),
      ...workstream(
        'ws_it',
        480,
        { Name: 'IT and telephony', Lead: 'IT manager', Status: 'Green' },
        [
          [
            't_survey',
            {
              Name: 'Survey the network',
              Owner: 'Network engineer',
              Status: 'Done',
              Effort: 24,
              Due: '2027-02-12',
            },
          ],
          [
            't_network',
            {
              Name: 'Install network and wifi',
              Owner: 'Network engineer',
              Status: 'Not started',
              Effort: 120,
              Due: '2027-06-25',
            },
          ],
          [
            't_servers',
            {
              Name: 'Move the servers',
              Owner: 'IT manager',
              Status: 'Not started',
              Effort: 80,
              Due: '2027-07-09',
            },
          ],
        ],
        [
          'd_network',
          {
            Name: 'Working network on all floors',
            Owner: 'IT manager',
            Status: 'Not started',
            Due: '2027-06-30',
          },
        ],
        [
          'm_itready',
          { Name: 'IT ready', Owner: 'IT manager', Date: '2027-07-02' },
        ],
      ),
      ...workstream(
        'ws_people',
        920,
        {
          Name: 'People and communication',
          Lead: 'HR business partner',
          Status: 'Green',
        },
        [
          [
            't_announce',
            {
              Name: 'Tell staff about the move',
              Owner: 'HR business partner',
              Status: 'Done',
              Effort: 12,
              Due: '2027-03-05',
            },
          ],
          [
            't_desks',
            {
              Name: 'Plan desks and teams',
              Owner: 'Office manager',
              Status: 'In progress',
              Effort: 40,
              Due: '2027-05-14',
            },
          ],
          [
            't_opendays',
            {
              Name: 'Run open days in the new office',
              Owner: 'Office manager',
              Status: 'Not started',
              Effort: 30,
              Due: '2027-06-18',
            },
          ],
        ],
        [
          'd_seating',
          {
            Name: 'Seating plan',
            Owner: 'Office manager',
            Status: 'In progress',
            Due: '2027-05-14',
          },
        ],
        [
          'm_briefed',
          {
            Name: 'Staff briefed',
            Owner: 'HR business partner',
            Date: '2027-03-12',
            Reached: true,
          },
        ],
      ),
      e(
        'm_movedin',
        'Milestone',
        590,
        510,
        { Name: 'Moved in', Owner: 'Programme manager', Date: '2027-07-19' },
        { parent: 'prog' },
      ),
      // The RAID log, below the plan.
      e('r_contractor', 'Risk', 40, 720, {
        Name: 'Fit-out contractor runs late',
        Owner: 'Facilities manager',
        Likelihood: 4,
        Impact: 4,
        Status: 'Open',
        Response: 'Reduce',
        Mitigation:
          'Weekly site meetings, and a penalty clause for late completion in the contract.',
      }),
      e('r_network', 'Risk', 540, 720, {
        Name: 'New network not ready in time',
        Owner: 'IT manager',
        Likelihood: 3,
        Impact: 5,
        Status: 'Open',
      }),
      e('r_move', 'Risk', 1060, 720, {
        Name: 'Systems down after the move',
        Owner: 'IT manager',
        Likelihood: 2,
        Impact: 5,
        Status: 'Open',
        Response: 'Reduce',
      }),
      e('a_weekends', 'Assumption', 310, 750, {
        Name: 'The landlord allows work at weekends',
        Owner: 'Facilities manager',
        Validated: false,
        Impact: 'High',
        CheckBy: '2027-02-15',
      }),
      e('i_late', 'Issue', 40, 900, {
        Name: 'Fit-out started two weeks late',
        Owner: 'Facilities manager',
        Severity: 'Medium',
        Status: 'Open',
        Due: '2027-03-19',
        Resolution:
          'The contractor adds a second crew for four weeks to win the time back.',
      }),
      e('dep_line', 'Dependency', 810, 748, {
        Name: 'Network line from the provider',
        Type: 'External',
        Provider: 'Telecoms provider',
        NeededBy: '2027-06-01',
        Status: 'At risk',
      }),
      e('dec_weekends', 'Decision', 1060, 900, {
        Name: 'Move over two weekends, not one',
        Status: 'Agreed',
        Date: '2027-02-10',
        DecidedBy: 'Steering group',
        Rationale:
          'Moving the servers on a separate weekend halves the time the systems are down and leaves a weekend to fix problems.',
      }),
    ],
    // Links between objects inside one container are drawn under its fill, so the sample keeps
    // to links that leave the plan.
    connectors: [
      c('DependsOn', 't_network', 'dep_line'),
      c('Affects', 'r_contractor', 't_fitout'),
      c('Affects', 'r_network', 'm_itready'),
      c('Affects', 'r_move', 't_servers'),
      c('Affects', 'a_weekends', 't_fitout'),
      c('TurnedInto', 'r_contractor', 'i_late'),
      c('Addresses', 'dec_weekends', 'r_move'),
    ],
  },
};
