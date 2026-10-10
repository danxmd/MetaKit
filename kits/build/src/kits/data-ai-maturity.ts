import type { KitId } from '@metakit-app/core';
import {
  choice,
  date,
  formula,
  line,
  long,
  look,
  scale,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Data and AI maturity assessment: dimensions hold capabilities scored from 1 to 5 now and as a
 * target; the gap and the importance give a priority, and actions improve the capabilities.
 */

const GAP_FILL = {
  by: 'GapLevel',
  values: {
    None: '#d3f9d8',
    Small: '#fff3bf',
    Medium: '#ffd8a8',
    Large: '#ffc9c9',
  },
  fallback: '#e9ecef',
};

const ACTION_FILL = {
  by: 'Status',
  values: {
    'Not started': '#e9ecef',
    'In progress': '#fff3bf',
    Done: '#d3f9d8',
    Blocked: '#ffc9c9',
  },
  fallback: '#e9ecef',
};

/** The averages of the capabilities inside a dimension, empty when there are none. */
const average = (key: string) =>
  `IFERROR(round(avg(children().${key}), 1), null)`;

const DIMENSIONS: {
  id: string;
  name: string;
  description: string;
  capabilities: [string, string, number, number, number][];
}[] = [
  {
    id: 'strategy',
    name: 'Strategy',
    description: 'How clearly data and AI serve the goals of the business.',
    capabilities: [
      ['strategy', 'Data and AI strategy', 2, 4, 4],
      ['value', 'Value tracking', 1, 3, 3],
    ],
  },
  {
    id: 'governance',
    name: 'Governance',
    description: 'Who decides about data, and by which rules.',
    capabilities: [
      ['ownership', 'Data ownership', 2, 4, 5],
      ['policies', 'Policies and standards', 2, 3, 3],
    ],
  },
  {
    id: 'quality',
    name: 'Data quality',
    description: 'How far the data can be trusted for its purpose.',
    capabilities: [
      ['monitoring', 'Quality monitoring', 1, 4, 4],
      ['master', 'Master data', 2, 3, 3],
    ],
  },
  {
    id: 'architecture',
    name: 'Architecture',
    description: 'The platforms and integrations that store and move data.',
    capabilities: [
      ['platform', 'Data platform', 3, 4, 4],
      ['integration', 'Integration', 3, 3, 2],
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Reporting and analysis that people use to decide.',
    capabilities: [
      ['reporting', 'Reporting and dashboards', 3, 4, 3],
      ['selfservice', 'Self-service analytics', 2, 4, 3],
    ],
  },
  {
    id: 'ai',
    name: 'AI and machine learning',
    description: 'Building, running and watching models.',
    capabilities: [
      ['development', 'Model development', 2, 4, 4],
      ['modelmonitoring', 'Model monitoring', 1, 4, 5],
    ],
  },
  {
    id: 'people',
    name: 'People and skills',
    description: 'The skills of everyone who works with data.',
    capabilities: [
      ['literacy', 'Data literacy', 2, 4, 4],
      ['specialists', 'Specialist skills', 2, 3, 3],
    ],
  },
  {
    id: 'operating',
    name: 'Operating model',
    description: 'Roles, teams and funding of data and AI work.',
    capabilities: [
      ['roles', 'Roles and responsibilities', 2, 4, 4],
      ['funding', 'Funding of data work', 2, 3, 2],
    ],
  },
];

const elements: SampleElement[] = [];
DIMENSIONS.forEach((d, i) => {
  const x = 40 + (i % 4) * 470;
  const y = 40 + Math.floor(i / 4) * 250;
  elements.push({
    id: `dim_${d.id}`,
    class: 'Dimension',
    x,
    y,
    w: 440,
    h: 210,
    attributes: { Name: d.name, Description: d.description },
  });
  d.capabilities.forEach(([id, name, current, target, importance], j) =>
    elements.push({
      id: `cap_${id}`,
      class: 'Capability',
      x: x + 20 + j * 210,
      y: y + 60,
      parent: `dim_${d.id}`,
      attributes: {
        Name: name,
        CurrentScore: current,
        TargetScore: target,
        Importance: importance,
      },
    }),
  );
});

const actions: [string, string, string, string, string][] = [
  [
    'owners',
    'Name an owner for each data domain',
    'In progress',
    '2027-06-30',
    'Medium',
  ],
  [
    'checks',
    'Automated quality checks on key tables',
    'Not started',
    '2027-09-30',
    'Large',
  ],
  [
    'refresh',
    'Refresh the strategy with business leaders',
    'Done',
    '2027-03-31',
    'Small',
  ],
  [
    'course',
    'Data literacy course for managers',
    'In progress',
    '2027-12-15',
    'Medium',
  ],
  [
    'pipeline',
    'Shared pipeline for building models',
    'Not started',
    '2028-03-31',
    'Large',
  ],
  [
    'training',
    'Self-service analytics training',
    'Not started',
    '2027-11-30',
    'Small',
  ],
];
actions.forEach(([id, name, status, due, effort], i) =>
  elements.push({
    id: `act_${id}`,
    class: 'Action',
    x: 40 + i * 310,
    y: 560,
    attributes: { Name: name, Status: status, Due: due, Effort: effort },
  }),
);
const people: [string, string, string][] = [
  ['priya', 'Priya Raman', 'Chief data officer'],
  ['tom', 'Tom Becker', 'Head of data platform'],
  ['sara', 'Sara Lindqvist', 'Head of analytics'],
];
people.forEach(([id, name, role], i) =>
  elements.push({
    id: `per_${id}`,
    class: 'Person',
    x: 300 + i * 620,
    y: 700,
    attributes: { Name: name, Role: role },
  }),
);

const c = (relation: string, from: string, to: string): SampleConnector => ({
  relation,
  from,
  to,
});

export const dataAiMaturity: KitSpec = {
  folder: 'data-ai-maturity',
  id: 'kit_dataaimaturity' as KitId,
  name: 'Data and AI maturity assessment',
  catalog: { keys: ['Person'] },
  classes: [
    {
      key: 'Dimension',
      label: 'Dimension',
      help: 'An area of the assessment, such as governance or data quality. Place its capabilities inside it.',
      kind: 'container',
      look: look('container', {
        fill: '#f8f9fa',
        border: '#495057',
        title: 'Summary',
        width: 440,
        height: 210,
      }),
      attributes: [
        long('Description'),
        formula(
          'AverageCurrent',
          average('CurrentScore'),
          'number',
          'The average current score of the capabilities inside.',
        ),
        formula(
          'AverageTarget',
          average('TargetScore'),
          'number',
          'The average target score of the capabilities inside.',
        ),
        formula(
          'AverageGap',
          average('Gap'),
          'number',
          'The average gap of the capabilities inside.',
        ),
        formula(
          'Summary',
          "Name + ': now ' + (AverageCurrent ?? '-') + ', target ' + (AverageTarget ?? '-')",
          'text',
          'The name and the two averages, shown as the heading on the diagram.',
        ),
      ],
    },
    {
      key: 'Capability',
      label: 'Capability',
      help: 'Something the organisation must be able to do with data or AI, scored from 1 (initial) to 5 (optimised) now and as a target.',
      look: look('header-box', {
        fill: GAP_FILL,
        border: '#1c7ed6',
        fields: ['CurrentScore', 'TargetScore', 'Gap', 'Priority'],
        width: 190,
      }),
      attributes: [
        long('Description'),
        scale('CurrentScore', {
          help: '1 initial, 2 repeatable, 3 defined, 4 managed, 5 optimised.',
        }),
        scale('TargetScore', {
          help: 'The score the organisation needs, on the same scale.',
        }),
        scale('Importance', {
          help: 'How much the capability matters for the goals of the business.',
        }),
        long('Evidence', {
          help: 'What the score is based on: interviews, documents, measurements.',
        }),
        text('AssessedBy'),
        date('AssessedOn'),
        formula(
          'Gap',
          'CurrentScore == null || TargetScore == null ? null : TargetScore - CurrentScore',
          'number',
          'Target score minus current score.',
        ),
        formula(
          'GapLevel',
          "Gap == null ? null : Gap <= 0 ? 'None' : Gap == 1 ? 'Small' : Gap == 2 ? 'Medium' : 'Large'",
          'text',
          'None, Small (1), Medium (2) or Large (3 or more). The fill shows it.',
        ),
        formula(
          'PriorityScore',
          'Gap == null || Importance == null ? null : (Gap > 0 ? Gap * Importance : 0)',
          'number',
          'Gap times importance, from 0 to 20.',
        ),
        formula(
          'Priority',
          "PriorityScore == null ? null : PriorityScore >= 10 ? 'High' : PriorityScore >= 5 ? 'Medium' : PriorityScore > 0 ? 'Low' : 'None'",
          'text',
          'High from a priority score of 10, Medium from 5, Low above 0.',
        ),
        formula(
          'Actions',
          "count(incoming('Improves'))",
          'number',
          'How many actions improve this capability.',
        ),
      ],
      constraints: [
        {
          id: 'k_capability_target',
          formula:
            'CurrentScore == null || TargetScore == null || TargetScore >= CurrentScore',
          message:
            "= 'The target score of \"' + Name + '\" is below its current score.'",
        },
        {
          id: 'k_capability_action',
          formula: "Priority != 'High' || Actions > 0",
          message:
            "= '\"' + Name + '\" has a high priority but no action improves it.'",
        },
      ],
    },
    {
      key: 'Action',
      label: 'Action',
      help: 'A piece of work that raises the score of one or more capabilities.',
      look: look('rounded', {
        fill: ACTION_FILL,
        border: '#f08c00',
        subtitle: 'Due',
        width: 280,
      }),
      attributes: [
        long('Description'),
        choice('Status', ['Not started', 'In progress', 'Done', 'Blocked'], {
          default: 'Not started',
        }),
        date('Due'),
        choice('Effort', ['Small', 'Medium', 'Large']),
        formula(
          'Owner',
          "join(incoming('Owns').Name, ', ')",
          'text',
          'The people with an "Owns" connector to this action.',
        ),
      ],
      constraints: [
        {
          id: 'k_action_improves',
          formula: "count(outgoing('Improves')) > 0",
          message: "= 'Action \"' + Name + '\" improves no capability.'",
        },
      ],
    },
  ],
  relations: [
    {
      key: 'Improves',
      label: 'Improves',
      help: 'The action raises the score of the capability.',
      from: ['Action'],
      to: ['Capability'],
      look: line('#f08c00'),
    },
  ],
  amendRelations: {
    Owns: { to: ['Action', 'Capability', 'Dimension'], replace: true },
  },
  modelTypes: [
    {
      key: 'Assessment',
      label: 'Maturity assessment',
      help: 'Dimensions with their capabilities scored now and as a target, the gaps and priorities, and the actions that close them.',
      views: [
        {
          key: 'Scores',
          label: 'Scores',
          classes: ['Dimension', 'Capability'],
          relations: [],
        },
        {
          key: 'ActionPlan',
          label: 'Action plan',
          classes: ['Capability', 'Action', 'Person'],
          relations: ['Improves', 'Owns'],
        },
      ],
      containers: { Dimension: ['Capability'] },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        date('AssessmentDate'),
        formula(
          'OverallCurrent',
          "IFERROR(round(avg(objects('Capability').CurrentScore), 1), null)",
          'number',
          'The average current score of all capabilities.',
        ),
        formula(
          'OverallTarget',
          "IFERROR(round(avg(objects('Capability').TargetScore), 1), null)",
          'number',
          'The average target score of all capabilities.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Capability',
      tabs: [
        {
          label: 'Score',
          items: [
            'Name',
            'CurrentScore',
            'TargetScore',
            'Importance',
            'Gap',
            'Priority',
          ],
        },
        {
          label: 'Evidence',
          items: [
            { attribute: 'Description', control: 'textarea' },
            { attribute: 'Evidence', control: 'textarea' },
            'AssessedBy',
            'AssessedOn',
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Action',
      tabs: [
        {
          label: 'Action',
          items: [
            'Name',
            { attribute: 'Status', control: 'segmented' },
            'Due',
            { attribute: 'Effort', control: 'segmented' },
            'Owner',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
      ],
      showRelations: true,
    },
  ],
  rules: [
    {
      id: 'rule_actiondone',
      label: 'Ask to score again when an action is done',
      when: {
        event: 'attribute.changed',
        class: 'Action',
        attribute: 'Status',
      },
      if: "= Status == 'Done'",
      then: [
        {
          action: 'message',
          kind: 'info',
          text: "= 'Action \"' + Name + '\" is done. Score these capabilities again: ' + join(outgoing('Improves').Name, ', ') + '.'",
        },
      ],
    },
  ],
  sample: {
    file: 'maturity-2027.mkmodel.json',
    id: 'mdl_maturity2027',
    name: 'Data and AI maturity 2027',
    modelType: 'Assessment',
    attributes: {
      Title: 'Data and AI maturity 2027',
      Organisation: 'A logistics company',
      AssessmentDate: '2027-01-29',
    },
    // "Model monitoring" has a high priority and no action, on purpose.
    intendedWarnings: 1,
    elements,
    connectors: [
      c('Improves', 'act_owners', 'cap_ownership'),
      c('Improves', 'act_owners', 'cap_roles'),
      c('Improves', 'act_checks', 'cap_monitoring'),
      c('Improves', 'act_refresh', 'cap_strategy'),
      c('Improves', 'act_refresh', 'cap_value'),
      c('Improves', 'act_course', 'cap_literacy'),
      c('Improves', 'act_pipeline', 'cap_development'),
      c('Improves', 'act_training', 'cap_selfservice'),
      c('Owns', 'per_priya', 'act_owners'),
      c('Owns', 'per_priya', 'act_refresh'),
      c('Owns', 'per_tom', 'act_checks'),
      c('Owns', 'per_tom', 'act_pipeline'),
      c('Owns', 'per_sara', 'act_course'),
      c('Owns', 'per_sara', 'act_training'),
    ],
  },
};
