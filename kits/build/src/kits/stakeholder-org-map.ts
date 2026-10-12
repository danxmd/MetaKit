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
  type RelationSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Stakeholder and organisation map: organisation units with their roles and people, reporting
 * lines, stakeholders placed on an interest and influence grid with their attitude, and RACI
 * relations from people, roles and units to activities and deliverables.
 */

const QUADRANT_FORMULA =
  "Influence == null || Interest == null ? null : (Influence >= 3 ? (Interest >= 3 ? 'Manage closely' : 'Keep satisfied') : (Interest >= 3 ? 'Keep informed' : 'Monitor'))";
const QUADRANTS = [
  'Manage closely',
  'Keep satisfied',
  'Keep informed',
  'Monitor',
];
const QUADRANT_TONE: Record<string, string> = {
  'Manage closely': '#ffc9c9',
  'Keep satisfied': '#ffd8a8',
  'Keep informed': '#d0ebff',
  Monitor: '#e9ecef',
};
const ADVICE: Record<string, string> = {
  'Manage closely':
    'High influence and high interest: involve them in decisions.',
  'Keep satisfied':
    'High influence, less interest: consult them on what matters to them.',
  'Keep informed': 'High interest, less influence: inform them often.',
  Monitor: 'Less influence and less interest: watch for changes.',
};

const RACI_ENDS = { from: ['Person', 'Role', 'OrganisationUnit'] };
const raci = (
  key: string,
  help: string,
  look: RelationSpec['look'],
): RelationSpec => ({
  key,
  label: key,
  help,
  ...RACI_ENDS,
  to: ['Activity', 'Deliverable'],
  look,
});
const raciNames = (key: string) =>
  formula(
    key,
    `join(incoming('${key}').Name, ', ')`,
    'text',
    `Who is ${key.toLowerCase()}: the people, roles and units with a "${key}" connector to it.`,
  );
const RACI_ATTRIBUTES = [
  raciNames('Responsible'),
  raciNames('Accountable'),
  raciNames('Consulted'),
  raciNames('Informed'),
];
const raciChecks = (what: string) => [
  {
    id: `k_${what.toLowerCase()}_accountable`,
    formula: "count(incoming('Accountable')) == 1",
    message: `= '${what} "' + Name + '" should have exactly one accountable person, role or unit.'`,
  },
  {
    id: `k_${what.toLowerCase()}_responsible`,
    formula: "count(incoming('Responsible')) > 0",
    message: `= 'Nobody is responsible for ${what.toLowerCase()} "' + Name + '".'`,
  },
];

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
const stakeholder = (
  id: string,
  quadrant: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
) => e(id, 'Stakeholder', x, y, attributes, { parent: quadrant });

export const stakeholderOrgMap: KitSpec = {
  folder: 'stakeholder-org-map',
  id: 'kit_stakeholdermap' as KitId,
  name: 'Stakeholder and organisation map',
  catalog: {
    keys: ['OrganisationUnit', 'Role', 'Person', 'Stakeholder', 'Deliverable'],
    // RACI says who does what; a general "Owns" would compete with Accountable.
    skipRelations: ['Owns'],
  },
  classes: [
    {
      key: 'GridQuadrant',
      label: 'Grid quadrant',
      help: 'One quarter of the interest and influence grid. Place the stakeholders whose scores fall in it inside it.',
      kind: 'container',
      look: look('container', {
        fill: {
          by: 'Quadrant',
          values: Object.fromEntries(
            QUADRANTS.map((q) => [q, `${QUADRANT_TONE[q]}55`]),
          ),
          fallback: '#f1f3f555',
        },
        border: '#495057',
        width: 270,
        height: 260,
      }),
      attributes: [
        choice('Quadrant', QUADRANTS, { required: true }),
        formula(
          'Advice',
          QUADRANTS.reduceRight(
            (rest, q) => `Quadrant == '${q}' ? '${ADVICE[q]}' : (${rest})`,
            'null',
          ),
          'text',
          'How to engage the stakeholders in this quadrant.',
        ),
      ],
    },
    {
      key: 'Activity',
      label: 'Activity',
      help: 'A piece of work in the change, with RACI: who is responsible, accountable, consulted and informed.',
      look: look('header-box', {
        fill: '#ffd8a8',
        border: '#f08c00',
        icon: 'gear',
        fields: ['Responsible', 'Accountable', 'Due'],
        width: 220,
      }),
      attributes: [
        long('Description'),
        date('Due'),
        choice('Status', ['Not started', 'In progress', 'Done']),
        ...RACI_ATTRIBUTES,
      ],
      constraints: raciChecks('Activity'),
    },
  ],
  amend: {
    OrganisationUnit: {
      look: look('container', {
        // See-through, so reporting lines and RACI lines stay visible.
        fill: '#f1f3f566',
        border: '#495057',
        width: 420,
        height: 300,
      }),
    },
    Role: {
      attributes: [
        formula(
          'FilledBy',
          "join(incoming('Fills').Name, ', ')",
          'text',
          'The people who fill this role.',
        ),
      ],
      constraints: [
        {
          id: 'k_role_filled',
          formula: "count(incoming('Fills')) > 0",
          message: "= 'Nobody fills the role \"' + Name + '\".'",
        },
      ],
    },
    Person: {
      attributes: [
        text('Role', { label: 'Job title' }),
        formula(
          'Manager',
          "join(outgoing('ReportsTo').Name, ', ')",
          'text',
          'The person this person reports to.',
        ),
      ],
      constraints: [
        {
          id: 'k_person_manager',
          formula: "count(outgoing('ReportsTo')) <= 1",
          message: "= '\"' + Name + '\" reports to more than one person.'",
        },
      ],
    },
    Stakeholder: {
      help: 'A person, group or organisation with an interest in the change, scored on interest and influence, with their attitude now and the attitude needed.',
      attributes: [
        choice('Kind', ['Person', 'Group', 'Organisation']),
        scale('Interest', { help: 'How much the change matters to them.' }),
        scale('Influence', {
          help: 'How much they can affect the change.',
        }),
        choice(
          'Attitude',
          ['Champion', 'Supportive', 'Neutral', 'Sceptical', 'Resistant'],
          { help: 'How they see the change now.' },
        ),
        choice(
          'DesiredAttitude',
          ['Champion', 'Supportive', 'Neutral', 'Sceptical', 'Resistant'],
          { help: 'The attitude the change needs from them.' },
        ),
        long('EngagementPlan'),
        formula(
          'Quadrant',
          QUADRANT_FORMULA,
          'text',
          'Manage closely (influence and interest 3 or more), Keep satisfied (influence 3 or more), Keep informed (interest 3 or more) or Monitor. The fill shows it.',
        ),
      ],
      look: look('person', {
        fill: {
          by: 'Quadrant',
          values: QUADRANT_TONE,
          fallback: '#e9ecef',
        },
        border: {
          by: 'Attitude',
          values: {
            Champion: '#2f9e44',
            Supportive: '#2f9e44',
            Neutral: '#868e96',
            Sceptical: '#f08c00',
            Resistant: '#e03131',
          },
          fallback: '#868e96',
        },
        borderWidth: 2.5,
        subtitle: 'Attitude',
        width: 110,
      }),
      constraints: [
        {
          id: 'k_stakeholder_quadrant',
          formula:
            'parent == null || parent.Quadrant == null || Quadrant == null || parent.Quadrant == Quadrant',
          message:
            "= 'Stakeholder \"' + Name + '\" sits in \"' + parent.Quadrant + '\", but its scores put it in \"' + Quadrant + '\".'",
        },
        {
          id: 'k_stakeholder_plan',
          formula:
            "Quadrant != 'Manage closely' || (Attitude != 'Sceptical' && Attitude != 'Resistant') || !isEmpty(EngagementPlan)",
          message:
            "= 'Stakeholder \"' + Name + '\" is a key player and ' + lower(Attitude) + ', but has no engagement plan.'",
        },
      ],
    },
    Deliverable: {
      attributes: RACI_ATTRIBUTES,
      look: look('header-box', {
        fill: '#fff3bf',
        border: '#f08c00',
        icon: 'document',
        fields: ['Responsible', 'Accountable', 'Due'],
        width: 220,
      }),
      constraints: raciChecks('Deliverable'),
    },
  },
  relations: [
    {
      key: 'ReportsTo',
      label: 'Reports to',
      help: 'The person reports to their manager.',
      from: ['Person'],
      to: ['Person'],
      look: line('#495057', { end: 'triangle' }),
    },
    {
      key: 'Fills',
      label: 'Fills',
      help: 'The person fills the role.',
      from: ['Person'],
      to: ['Role'],
      look: line('#495057', { style: 'dotted' }),
    },
    {
      key: 'Influences',
      label: 'Influences',
      help: 'One stakeholder sways the opinion of another.',
      from: ['Stakeholder'],
      to: ['Stakeholder'],
      look: line('#6741d9', { style: 'dashed' }),
    },
    raci('Responsible', 'Does the work.', line('#1c7ed6')),
    raci(
      'Accountable',
      'Answers for the result and signs it off. One per activity or deliverable.',
      line('#e03131', { end: 'triangle' }),
    ),
    raci(
      'Consulted',
      'Gives input before the work is done.',
      line('#f08c00', { style: 'dashed' }),
    ),
    raci(
      'Informed',
      'Is told about the result.',
      line('#868e96', { style: 'dotted' }),
    ),
  ],
  modelTypes: [
    {
      key: 'StakeholderMap',
      label: 'Stakeholder and organisation map',
      help: 'Organisation units with roles and people, stakeholders on an interest and influence grid, and RACI for activities and deliverables.',
      views: [
        {
          key: 'Organisation',
          label: 'Organisation',
          classes: ['OrganisationUnit', 'Role', 'Person'],
          relations: ['ReportsTo', 'Fills'],
        },
        {
          key: 'Stakeholders',
          label: 'Stakeholders',
          classes: ['GridQuadrant', 'Stakeholder'],
          relations: ['Influences'],
        },
        {
          key: 'RACI',
          label: 'RACI',
          classes: [
            'OrganisationUnit',
            'Role',
            'Person',
            'Activity',
            'Deliverable',
          ],
          relations: ['Responsible', 'Accountable', 'Consulted', 'Informed'],
        },
      ],
      cardinalities: [{ kind: 'count', class: 'GridQuadrant', max: 4 }],
      containers: {
        OrganisationUnit: ['OrganisationUnit', 'Role', 'Person'],
        GridQuadrant: ['Stakeholder'],
      },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        text('Change', { help: 'The programme or change the map is for.' }),
        formula(
          'People',
          "count(objects('Person'))",
          'number',
          'How many people the map shows.',
        ),
        formula(
          'Stakeholders',
          "count(objects('Stakeholder'))",
          'number',
          'How many stakeholders the map shows.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Stakeholder',
      tabs: [
        {
          label: 'Stakeholder',
          items: [
            'Name',
            { attribute: 'Kind', control: 'segmented' },
            'Interest',
            'Influence',
            'Quadrant',
          ],
        },
        {
          label: 'Engagement',
          items: [
            { attribute: 'Attitude', control: 'select' },
            { attribute: 'DesiredAttitude', control: 'select' },
            { attribute: 'EngagementPlan', control: 'textarea' },
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Activity',
      tabs: [
        {
          label: 'Activity',
          items: [
            'Name',
            { attribute: 'Description', control: 'textarea' },
            'Due',
            { attribute: 'Status', control: 'segmented' },
          ],
        },
        {
          label: 'RACI',
          items: ['Responsible', 'Accountable', 'Consulted', 'Informed'],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'finance-system.mkmodel.json',
    id: 'mdl_financesystem',
    name: 'Finance system replacement',
    modelType: 'StakeholderMap',
    attributes: {
      Title: 'Finance system replacement',
      Organisation: 'A manufacturing company',
      Change: 'Replace the finance system by mid 2028',
    },
    // Nobody is accountable for "Training material" yet, on purpose.
    intendedWarnings: 1,
    elements: [
      // The organisation.
      e(
        'ou_company',
        'OrganisationUnit',
        20,
        20,
        { Name: 'Finance and IT', Head: 'Chief financial officer' },
        { w: 900, h: 330 },
      ),
      e(
        'ou_finance',
        'OrganisationUnit',
        40,
        60,
        { Name: 'Finance', Code: 'FIN', Head: 'Anna Berg' },
        { w: 430, h: 270, parent: 'ou_company' },
      ),
      e(
        'p_anna',
        'Person',
        60,
        100,
        { Name: 'Anna Berg', Role: 'Finance director' },
        { parent: 'ou_finance' },
      ),
      e(
        'p_omar',
        'Person',
        200,
        100,
        { Name: 'Omar Haddad', Role: 'Accounts payable lead' },
        { parent: 'ou_finance' },
      ),
      e(
        'p_lena',
        'Person',
        340,
        100,
        { Name: 'Lena Fischer', Role: 'Financial controller' },
        { parent: 'ou_finance' },
      ),
      e(
        'r_owner',
        'Role',
        70,
        270,
        { Name: 'Business owner' },
        { parent: 'ou_finance' },
      ),
      e(
        'r_keyuser',
        'Role',
        280,
        270,
        { Name: 'Key user' },
        { parent: 'ou_finance' },
      ),
      e(
        'ou_it',
        'OrganisationUnit',
        490,
        60,
        { Name: 'IT', Code: 'IT', Head: 'Jonas Weber' },
        { w: 410, h: 270, parent: 'ou_company' },
      ),
      e(
        'p_jonas',
        'Person',
        510,
        100,
        { Name: 'Jonas Weber', Role: 'IT project manager' },
        { parent: 'ou_it' },
      ),
      e(
        'p_sofia',
        'Person',
        680,
        100,
        { Name: 'Sofia Rossi', Role: 'Data analyst' },
        { parent: 'ou_it' },
      ),
      e(
        'r_pm',
        'Role',
        520,
        270,
        { Name: 'Project manager' },
        { parent: 'ou_it' },
      ),
      e(
        'r_data',
        'Role',
        700,
        270,
        { Name: 'Data specialist' },
        { parent: 'ou_it' },
      ),
      // RACI.
      e('act_choose', 'Activity', 40, 420, {
        Name: 'Choose the new system',
        Due: '2027-03-31',
        Status: 'Done',
      }),
      e('act_migrate', 'Activity', 275, 420, {
        Name: 'Migrate supplier data',
        Due: '2027-11-30',
        Status: 'In progress',
      }),
      e('del_plan', 'Deliverable', 510, 420, {
        Name: 'Migration plan',
        Due: '2027-06-30',
        Status: 'Done',
      }),
      e('del_training', 'Deliverable', 745, 420, {
        Name: 'Training material',
        Due: '2028-02-28',
        Status: 'Not started',
      }),
      // The stakeholder grid: influence upwards, interest to the right.
      e(
        'q_satisfied',
        'GridQuadrant',
        1000,
        40,
        { Name: 'Keep satisfied', Quadrant: 'Keep satisfied' },
        { w: 270, h: 260 },
      ),
      e(
        'q_manage',
        'GridQuadrant',
        1290,
        40,
        { Name: 'Manage closely', Quadrant: 'Manage closely' },
        { w: 270, h: 260 },
      ),
      e(
        'q_monitor',
        'GridQuadrant',
        1000,
        320,
        { Name: 'Monitor', Quadrant: 'Monitor' },
        { w: 270, h: 260 },
      ),
      e(
        'q_informed',
        'GridQuadrant',
        1290,
        320,
        { Name: 'Keep informed', Quadrant: 'Keep informed' },
        { w: 270, h: 260 },
      ),
      stakeholder('s_auditor', 'q_satisfied', 1080, 110, {
        Name: 'External auditor',
        Kind: 'Organisation',
        Interest: 2,
        Influence: 4,
        Attitude: 'Neutral',
        DesiredAttitude: 'Supportive',
      }),
      stakeholder('s_board', 'q_manage', 1310, 110, {
        Name: 'Management board',
        Kind: 'Group',
        Interest: 3,
        Influence: 5,
        Attitude: 'Champion',
        DesiredAttitude: 'Champion',
      }),
      stakeholder('s_council', 'q_manage', 1430, 110, {
        Name: 'Works council',
        Kind: 'Group',
        Interest: 4,
        Influence: 4,
        Attitude: 'Sceptical',
        DesiredAttitude: 'Neutral',
        EngagementPlan:
          'Monthly briefing on jobs and training; a seat in the steering group.',
      }),
      stakeholder('s_sales', 'q_monitor', 1080, 390, {
        Name: 'Sales team',
        Kind: 'Group',
        Interest: 2,
        Influence: 2,
        Attitude: 'Neutral',
      }),
      stakeholder('s_clerks', 'q_informed', 1310, 390, {
        Name: 'Accounts clerks',
        Kind: 'Group',
        Interest: 5,
        Influence: 2,
        Attitude: 'Sceptical',
        DesiredAttitude: 'Supportive',
      }),
      stakeholder('s_suppliers', 'q_informed', 1430, 390, {
        Name: 'Suppliers',
        Kind: 'Organisation',
        Interest: 4,
        Influence: 2,
        Attitude: 'Neutral',
      }),
    ],
    connectors: [
      c('ReportsTo', 'p_omar', 'p_anna'),
      c('ReportsTo', 'p_lena', 'p_anna'),
      c('ReportsTo', 'p_sofia', 'p_jonas'),
      c('Fills', 'p_anna', 'r_owner'),
      c('Fills', 'p_omar', 'r_keyuser'),
      c('Fills', 'p_lena', 'r_keyuser'),
      c('Fills', 'p_jonas', 'r_pm'),
      c('Fills', 'p_sofia', 'r_data'),
      c('Accountable', 'r_owner', 'act_choose'),
      c('Responsible', 'r_pm', 'act_choose'),
      c('Consulted', 'r_keyuser', 'act_choose'),
      c('Accountable', 'r_pm', 'act_migrate'),
      c('Responsible', 'r_data', 'act_migrate'),
      c('Accountable', 'r_pm', 'del_plan'),
      c('Responsible', 'r_data', 'del_plan'),
      c('Informed', 'r_owner', 'del_plan'),
      c('Responsible', 'r_keyuser', 'del_training'),
      c('Influences', 's_council', 's_clerks'),
    ],
  },
};
