import type { KitId } from '@metakit-app/core';
import {
  bool,
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
 * Security threat model: a data flow diagram (processes, data stores, external entities and the
 * data flows between them) inside trust boundaries, the assets worth protecting, threats sorted by
 * the six STRIDE categories and scored by likelihood times impact, and the mitigations against
 * them. Trust boundaries are swimlanes, so the flows inside them stay visible.
 */

const LEVELS = ['Public', 'Internal', 'Confidential', 'Restricted'];
const DFD = ['Process', 'DataStore', 'ExternalEntity'];

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
const flow = (
  from: string,
  to: string,
  data: string,
  protocol: string,
  encrypted: boolean,
  authenticated: boolean,
) =>
  c('DataFlow', from, to, {
    Data: data,
    Protocol: protocol,
    Encrypted: encrypted,
    Authenticated: authenticated,
  });

export const threatModel: KitSpec = {
  folder: 'threat-model',
  id: 'kit_threatmodel' as KitId,
  name: 'Security threat model',
  catalog: { keys: [] },
  classes: [
    {
      key: 'TrustBoundary',
      label: 'Trust boundary',
      help: 'A line inside which everything trusts everything else to the same degree, such as a company network. Data that crosses it needs protection. A lane for the processes, data stores and entities inside it.',
      kind: 'swimlane',
      look: {
        ...look('swimlane', {
          fill: '#ffe3e3',
          border: '#e03131',
          borderWidth: 2,
          width: 760,
          height: 400,
        }),
        borderStyle: 'dashed',
      },
      attributes: [
        long('Description'),
        choice('TrustLevel', ['Untrusted', 'Partly trusted', 'Trusted']),
      ],
    },
    {
      key: 'Process',
      label: 'Process',
      help: 'Software that handles data, such as a web application or a service.',
      look: look('circle', {
        fill: '#d0ebff',
        border: '#1c7ed6',
        subtitle: 'Technology',
        width: 160,
        height: 100,
      }),
      attributes: [
        long('Description'),
        text('Technology'),
        text('RunsAs', {
          label: 'Runs as',
          help: 'The account or privilege it runs with.',
        }),
      ],
    },
    {
      key: 'DataStore',
      label: 'Data store',
      help: 'Where data is kept, such as a database, a file store or a queue.',
      look: look('box', {
        fill: '#e7f5ff',
        border: '#1c7ed6',
        icon: 'database',
        subtitle: 'Classification',
        width: 160,
      }),
      attributes: [
        long('Description'),
        text('Technology'),
        choice('Classification', LEVELS),
      ],
    },
    {
      key: 'ExternalEntity',
      label: 'External entity',
      help: 'A person or system outside the scope of the model that sends or receives data, such as a user or a partner system.',
      look: look('box', {
        fill: '#f1f3f5',
        border: '#495057',
        borderWidth: 2,
        subtitle: 'Kind',
        width: 160,
      }),
      attributes: [
        long('Description'),
        choice('Kind', ['Person', 'System', 'Organisation']),
      ],
    },
    {
      key: 'Asset',
      label: 'Asset',
      help: 'Something worth protecting, such as personal data, money or the good name of the organisation.',
      look: look('hexagon', {
        fill: '#fff3bf',
        border: '#f08c00',
        icon: 'star',
        subtitle: 'Classification',
        width: 190,
        height: 80,
      }),
      attributes: [
        long('Description'),
        choice('Classification', LEVELS),
        text('Owner'),
      ],
    },
    {
      key: 'Threat',
      label: 'Threat',
      help: 'Something an attacker or an accident could do, sorted into one of the six STRIDE categories and scored by likelihood times impact.',
      look: look('header-box', {
        fill: {
          by: 'Rating',
          values: { Low: '#d3f9d8', Medium: '#fff3bf', High: '#ffc9c9' },
          fallback: '#e9ecef',
        },
        border: '#c92a2a',
        icon: 'warning',
        fields: ['Category', 'Score', 'Rating', 'Status'],
        width: 220,
      }),
      attributes: [
        long('Description'),
        choice(
          'Category',
          [
            'Spoofing',
            'Tampering',
            'Repudiation',
            'Information disclosure',
            'Denial of service',
            'Elevation of privilege',
          ],
          {
            help: 'Spoofing: pretending to be someone else. Tampering: changing data. Repudiation: denying an action. Information disclosure: reading what one should not. Denial of service: making it unavailable. Elevation of privilege: gaining rights one should not have.',
          },
        ),
        scale('Likelihood'),
        scale('Impact'),
        choice('Status', ['Open', 'Mitigated', 'Accepted', 'Transferred'], {
          default: 'Open',
        }),
        text('Owner'),
        formula(
          'Score',
          'Likelihood == null || Impact == null ? null : Likelihood * Impact',
          'number',
          'Likelihood times impact, from 1 to 25.',
        ),
        formula(
          'Rating',
          "Score == null ? null : (Score >= 15 ? 'High' : (Score >= 8 ? 'Medium' : 'Low'))",
          'text',
          'High from 15, Medium from 8, otherwise Low. It colours the threat.',
        ),
        formula(
          'Mitigations',
          "count(incoming('Mitigates'))",
          'number',
          'How many mitigations work against it.',
        ),
      ],
      constraints: [
        {
          id: 'k_threat_high',
          formula:
            "Rating != 'High' || Status == 'Accepted' || Status == 'Transferred' || Mitigations > 0",
          message:
            '= \'High threat "\' + Name + \'" has no mitigation: connect one with "Mitigates", or record that the risk is accepted or transferred.\'',
        },
        {
          id: 'k_threat_target',
          formula: "count(outgoing('Threatens')) > 0",
          message:
            "= 'Threat \"' + Name + '\" threatens nothing: connect it to the process, data store, entity or asset at risk.'",
        },
      ],
    },
    {
      key: 'Mitigation',
      label: 'Mitigation',
      help: 'A measure that makes a threat less likely or less harmful, such as encryption or an audit log.',
      look: look('rounded', {
        fill: {
          by: 'Status',
          values: {
            Planned: '#fff4e6',
            'In progress': '#ffe8cc',
            'In place': '#d3f9d8',
            Verified: '#b2f2bb',
          },
          fallback: '#fff4e6',
        },
        border: '#2f9e44',
        icon: 'check',
        subtitle: 'Status',
        width: 200,
      }),
      attributes: [
        long('Description'),
        choice('Kind', ['Prevent', 'Detect', 'Respond']),
        choice('Status', ['Planned', 'In progress', 'In place', 'Verified'], {
          default: 'Planned',
        }),
        text('Owner'),
        date('Due'),
      ],
      constraints: [
        {
          id: 'k_mitigation_target',
          formula: "count(outgoing('Mitigates')) > 0",
          message: "= 'Mitigation \"' + Name + '\" mitigates no threat.'",
        },
      ],
    },
  ],
  relations: [
    {
      key: 'DataFlow',
      label: 'Data flow',
      help: 'Data moves from one process, store or entity to another. A flow that crosses a trust boundary is drawn red until it is encrypted and authenticated.',
      from: DFD,
      to: DFD,
      attributes: [
        text('Data', { help: 'What moves, such as "expense claims".' }),
        text('Protocol', { help: 'How it moves, such as "HTTPS".' }),
        bool('Encrypted'),
        bool('Authenticated', {
          help: 'Yes when both ends prove who they are.',
        }),
        formula(
          'CrossesBoundary',
          'from.parent != to.parent',
          'boolean',
          'Yes when the two ends sit in different trust boundaries, or one of them in none.',
          { label: 'Crosses a boundary' },
        ),
        formula(
          'Unprotected',
          'CrossesBoundary && !(Encrypted == true && Authenticated == true)',
          'boolean',
          'Yes when it crosses a trust boundary without being both encrypted and authenticated. It colours the line.',
        ),
        formula(
          'Label',
          "(Data ?? '') + (isEmpty(Protocol) ? '' : ' [' + Protocol + ']')",
          'text',
          'The data and the protocol, shown on the line.',
        ),
      ],
      constraints: [
        {
          id: 'k_flow_boundary',
          formula: '!Unprotected',
          message:
            "= 'The data flow \"' + (Data ?? '') + '\" from \"' + from.Name + '\" to \"' + to.Name + '\" crosses a trust boundary but is not ' + (Encrypted == true ? 'authenticated' : (Authenticated == true ? 'encrypted' : 'encrypted or authenticated')) + '.'",
        },
      ],
      look: line(
        {
          by: 'Unprotected',
          values: { true: '#e03131', false: '#495057' },
          fallback: '#495057',
        },
        { label: 'Label' },
      ),
    },
    {
      key: 'Threatens',
      label: 'Threatens',
      help: 'The threat puts this process, store, entity or asset at risk.',
      from: ['Threat'],
      to: [...DFD, 'Asset'],
      look: line('#c92a2a', { style: 'dotted' }),
    },
    {
      key: 'Mitigates',
      label: 'Mitigates',
      help: 'The mitigation works against the threat.',
      from: ['Mitigation'],
      to: ['Threat'],
      look: line('#2f9e44', { end: 'bar' }),
    },
    {
      key: 'Holds',
      label: 'Holds',
      help: 'The data store keeps, or the process handles, the asset.',
      from: ['DataStore', 'Process'],
      to: ['Asset'],
      look: line('#f08c00', { style: 'dashed', end: 'none' }),
    },
  ],
  modelTypes: [
    {
      key: 'ThreatModel',
      label: 'Threat model',
      help: 'A data flow diagram inside trust boundaries, with the assets, threats and mitigations of the system.',
      views: [
        {
          key: 'DataFlows',
          label: 'Data flows',
          classes: ['TrustBoundary', ...DFD],
          relations: ['DataFlow'],
        },
        {
          key: 'Threats',
          label: 'Threats',
          classes: ['Threat', 'Mitigation', 'Asset', ...DFD],
          relations: ['Threatens', 'Mitigates', 'Holds'],
        },
      ],
      containers: { TrustBoundary: [...DFD, 'TrustBoundary'] },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('System'),
        text('Reviewer'),
        date('ReviewDate'),
        formula(
          'Threats',
          "count(objects('Threat'))",
          'number',
          'How many threats the model lists.',
        ),
        formula(
          'Mitigations',
          "count(objects('Mitigation'))",
          'number',
          'How many mitigations the model lists.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Threat',
      tabs: [
        {
          label: 'Threat',
          items: [
            'Name',
            { attribute: 'Category', control: 'select' },
            { attribute: 'Description', control: 'textarea' },
            'Owner',
            { attribute: 'Status', control: 'select' },
          ],
        },
        {
          label: 'Score',
          items: ['Likelihood', 'Impact', 'Score', 'Rating', 'Mitigations'],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'expenses-app.mkmodel.json',
    id: 'mdl_expensesapp',
    name: 'Staff expenses app',
    modelType: 'ThreatModel',
    attributes: {
      Title: 'Staff expenses app',
      System: 'Expenses app of a mid-sized retailer',
      Reviewer: 'Security architect',
      ReviewDate: '2027-04-08',
    },
    // The payment instructions leave the boundary without authentication, and the threat that
    // they are changed on the way has no mitigation yet: two warnings on purpose.
    intendedWarnings: 2,
    elements: [
      e('ee_employee', 'ExternalEntity', 20, 110, {
        Name: 'Employee',
        Kind: 'Person',
      }),
      e('ee_manager', 'ExternalEntity', 20, 315, {
        Name: 'Line manager',
        Kind: 'Person',
      }),
      e(
        'tb_cloud',
        'TrustBoundary',
        220,
        40,
        {
          Name: 'Company cloud',
          TrustLevel: 'Trusted',
          Description:
            'The cloud account of the company, reached only through its single sign-on.',
        },
        { w: 820, h: 400 },
      ),
      e(
        'p_web',
        'Process',
        470,
        95,
        { Name: 'Expenses web app', Technology: 'Web application' },
        { parent: 'tb_cloud' },
      ),
      e(
        'p_approval',
        'Process',
        470,
        300,
        { Name: 'Approval service', Technology: 'Background service' },
        { parent: 'tb_cloud' },
      ),
      e(
        'ds_claims',
        'DataStore',
        820,
        100,
        {
          Name: 'Expenses database',
          Technology: 'Relational database',
          Classification: 'Restricted',
        },
        { parent: 'tb_cloud' },
      ),
      e(
        'ds_receipts',
        'DataStore',
        820,
        210,
        {
          Name: 'Receipt store',
          Technology: 'File storage',
          Classification: 'Confidential',
        },
        { parent: 'tb_cloud' },
      ),
      e('ee_bank', 'ExternalEntity', 1120, 315, {
        Name: 'Bank payment system',
        Kind: 'System',
      }),
      e('as_bank', 'Asset', 1110, 90, {
        Name: 'Employee bank details',
        Classification: 'Restricted',
        Owner: 'Head of payroll',
      }),
      // Threats and mitigations below the diagram.
      e('th_password', 'Threat', 20, 500, {
        Name: 'Stolen manager password',
        Category: 'Spoofing',
        Likelihood: 4,
        Impact: 3,
        Status: 'Mitigated',
        Owner: 'Security architect',
      }),
      e('th_receipts', 'Threat', 790, 500, {
        Name: 'Receipts read by other staff',
        Category: 'Information disclosure',
        Likelihood: 3,
        Impact: 4,
        Status: 'Open',
        Owner: 'Product owner',
      }),
      e('th_deny', 'Threat', 440, 500, {
        Name: 'Manager denies an approval',
        Category: 'Repudiation',
        Likelihood: 2,
        Impact: 3,
        Status: 'Mitigated',
        Owner: 'Product owner',
      }),
      e('th_payment', 'Threat', 1100, 500, {
        Name: 'Payment file changed',
        Category: 'Tampering',
        Likelihood: 3,
        Impact: 5,
        Status: 'Open',
        Owner: 'Head of payroll',
      }),
      e('mi_sso', 'Mitigation', 30, 700, {
        Name: 'Single sign-on with a second factor',
        Kind: 'Prevent',
        Status: 'In place',
        Owner: 'IT security',
      }),
      e('mi_encrypt', 'Mitigation', 800, 700, {
        Name: 'Encrypt the receipt store',
        Kind: 'Prevent',
        Status: 'Planned',
        Owner: 'Platform team',
        Due: '2027-06-30',
      }),
      e('mi_audit', 'Mitigation', 450, 700, {
        Name: 'Audit log of approvals',
        Kind: 'Detect',
        Status: 'In place',
        Owner: 'Platform team',
      }),
    ],
    connectors: [
      flow('ee_employee', 'p_web', 'Expense claims', 'HTTPS', true, true),
      flow('p_web', 'ds_claims', 'Claims', 'SQL', true, true),
      flow('p_web', 'ds_receipts', 'Receipt images', 'HTTPS', true, true),
      flow('ee_manager', 'p_approval', 'Approvals', 'HTTPS', true, true),
      flow('p_web', 'p_approval', 'Claims to approve', 'HTTPS', true, true),
      flow('p_approval', 'ee_bank', 'Payment file', 'SFTP', true, false),
      c('Holds', 'ds_claims', 'as_bank'),
      c('Threatens', 'th_password', 'ee_manager'),
      c('Threatens', 'th_receipts', 'ds_receipts'),
      c('Threatens', 'th_deny', 'p_approval'),
      c('Threatens', 'th_payment', 'ee_bank'),
      c('Mitigates', 'mi_sso', 'th_password'),
      c('Mitigates', 'mi_encrypt', 'th_receipts'),
      c('Mitigates', 'mi_audit', 'th_deny'),
    ],
  },
};
