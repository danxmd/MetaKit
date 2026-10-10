import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
  int,
  line,
  long,
  look,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Enterprise architecture in three layers: the business (actors, roles, processes, services), the
 * applications that support it (components, interfaces, services, data objects) and the
 * technology they run on (nodes, system software, networks). The notation is MetaKit's own: one
 * colour per layer and plain relation names.
 */

const BUSINESS = { fill: '#b2f2bb', border: '#2f9e44' };
const APPLICATION = { fill: '#a5d8ff', border: '#1c7ed6' };
const TECHNOLOGY = { fill: '#96f2d7', border: '#0c8599' };

const BUSINESS_CLASSES = [
  'BusinessActor',
  'Role',
  'BusinessProcess',
  'BusinessService',
];
const APPLICATION_CLASSES = [
  'ApplicationComponent',
  'Interface',
  'ApplicationService',
  'DataObject',
];
const TECHNOLOGY_CLASSES = ['Node', 'SystemSoftware', 'Network'];

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

export const enterpriseArchitecture: KitSpec = {
  folder: 'enterprise-architecture',
  id: 'kit_enterprisearch' as KitId,
  name: 'Enterprise architecture',
  catalog: { keys: ['Role', 'BusinessProcess', 'Interface'] },
  classes: [
    {
      key: 'Layer',
      label: 'Layer',
      help: 'A band that gathers the elements of one layer: business, application or technology. Lines between layers stay visible across it.',
      kind: 'swimlane',
      look: look('swimlane', {
        fill: {
          by: 'Kind',
          values: {
            Business: BUSINESS.fill,
            Application: APPLICATION.fill,
            Technology: TECHNOLOGY.fill,
          },
          fallback: '#e9ecef',
        },
        border: '#adb5bd',
        width: 1300,
        height: 250,
      }),
      attributes: [
        choice('Kind', ['Business', 'Application', 'Technology']),
        long('Description'),
      ],
    },
    // Business layer.
    {
      key: 'BusinessActor',
      label: 'Business actor',
      help: 'A person, team or outside party that does something, such as a customer or a department.',
      look: look('person', { ...BUSINESS }),
      attributes: [
        long('Description'),
        choice('Kind', [
          'Person',
          'Team',
          'Organisation unit',
          'Outside party',
        ]),
      ],
    },
    {
      key: 'BusinessService',
      label: 'Business service',
      help: 'What the business offers to its customers or to other parts of the organisation, such as ordering or invoicing.',
      look: look('pill', { ...BUSINESS, icon: 'star', width: 170, height: 50 }),
      attributes: [
        long('Description'),
        text('Consumers', { help: 'Who uses it.' }),
        text('ServiceLevel', {
          help: 'What is promised, such as opening hours.',
        }),
      ],
      constraints: [
        {
          id: 'k_bservice_realised',
          formula: "count(incoming('Realises')) > 0",
          message:
            '= \'Business service "\' + Name + \'" is not realised: connect the process or application service that provides it with "Realises".\'',
        },
      ],
    },
    // Application layer.
    {
      key: 'ApplicationComponent',
      label: 'Application component',
      help: 'A piece of software with its own owner and life cycle, such as a web shop or an order system.',
      look: look('box', {
        ...APPLICATION,
        icon: 'gear',
        subtitle: 'Lifecycle',
        width: 170,
      }),
      attributes: [
        long('Description'),
        text('Owner'),
        choice(
          'Lifecycle',
          ['Plan', 'Invest', 'Tolerate', 'Migrate', 'Retire'],
          {
            help: 'What should happen to it: build it, invest in it, keep it as it is, move away from it, or switch it off.',
          },
        ),
        choice('Hosting', ['On-premises', 'Cloud', 'Software as a service']),
        int('Users', { min: 0 }),
        formula(
          'Supports',
          "count(outgoing('Serves')) + count(outgoing('Realises'))",
          'number',
          'How many elements it serves or realises.',
        ),
      ],
      constraints: [
        {
          id: 'k_component_retire',
          formula: "Lifecycle != 'Retire' || Supports == 0",
          message:
            "= 'Application component \"' + Name + '\" is to be retired but still serves or realises ' + Supports + ' element' + (Supports == 1 ? '' : 's') + ': move them to another component first.'",
        },
        {
          id: 'k_component_runs',
          formula:
            "Hosting == 'Software as a service' || count(incoming('AssignedTo')) > 0",
          message:
            '= \'Application component "\' + Name + \'" runs nowhere: connect the node or system software it runs on with "Assigned to".\'',
        },
      ],
    },
    {
      key: 'ApplicationService',
      label: 'Application service',
      help: 'A function that an application offers to the business or to other applications, such as order handling.',
      look: look('pill', {
        ...APPLICATION,
        icon: 'star',
        width: 170,
        height: 50,
      }),
      attributes: [long('Description')],
      constraints: [
        {
          id: 'k_aservice_realised',
          formula: "count(incoming('Realises')) > 0",
          message:
            '= \'Application service "\' + Name + \'" is not realised: connect the application component that provides it with "Realises".\'',
        },
      ],
    },
    {
      key: 'DataObject',
      label: 'Data object',
      help: 'Data that applications use and keep, such as an order or a customer record.',
      look: look('document', {
        ...APPLICATION,
        subtitle: 'Classification',
        width: 140,
        height: 80,
      }),
      attributes: [
        long('Description'),
        choice('Classification', [
          'Public',
          'Internal',
          'Confidential',
          'Restricted',
        ]),
        formula(
          'UsedBy',
          "count(incoming('Accesses'))",
          'number',
          'How many processes, components and services access it.',
        ),
      ],
      constraints: [
        {
          id: 'k_data_used',
          formula: 'UsedBy > 0',
          message: "= 'Data object \"' + Name + '\" is not used by anything.'",
        },
      ],
    },
    // Technology layer.
    {
      key: 'Node',
      label: 'Node',
      help: 'Something software runs on: a server, a virtual machine, a container platform, a cloud service or a device.',
      look: look('box', {
        ...TECHNOLOGY,
        icon: 'cloud',
        subtitle: 'Kind',
        width: 170,
      }),
      attributes: [
        long('Description'),
        choice('Kind', [
          'Physical server',
          'Virtual machine',
          'Container platform',
          'Cloud service',
          'Device',
        ]),
        text('Location'),
        choice('Environment', ['Development', 'Test', 'Production']),
        formula(
          'Runs',
          "count(outgoing('AssignedTo'))",
          'number',
          'How many components and system software it runs.',
        ),
      ],
    },
    {
      key: 'SystemSoftware',
      label: 'System software',
      help: 'Software that other software needs, such as an operating system, a database or middleware.',
      look: look('rounded', {
        ...TECHNOLOGY,
        icon: 'database',
        subtitle: 'Kind',
        width: 170,
      }),
      attributes: [
        long('Description'),
        choice('Kind', [
          'Operating system',
          'Database',
          'Middleware',
          'Runtime',
          'Other',
        ]),
        text('Version'),
      ],
    },
    {
      key: 'Network',
      label: 'Network',
      help: 'A network that connects nodes, such as a local network or the internet.',
      look: look('pill', {
        ...TECHNOLOGY,
        subtitle: 'Kind',
        width: 180,
        height: 54,
      }),
      attributes: [
        long('Description'),
        choice('Kind', [
          'Local network',
          'Wide area network',
          'Internet',
          'Private link',
        ]),
        text('Bandwidth'),
      ],
    },
  ],
  amend: {
    Role: {
      label: 'Business role',
      help: 'A part that actors play in the business, such as order clerk, independent of who fills it.',
      look: look('pill', { ...BUSINESS, icon: 'person', width: 160 }),
    },
    BusinessProcess: {
      attributes: [
        formula(
          'ServedBy',
          "count(incoming('Serves'))",
          'number',
          'How many services, components and interfaces serve it.',
        ),
      ],
    },
    Interface: {
      label: 'Application interface',
      help: 'A point where an application can be reached by people or other applications, such as a screen or an API, with the format it uses.',
      look: look('rounded', {
        ...APPLICATION,
        subtitle: 'Format',
        width: 150,
        height: 56,
      }),
    },
  },
  relations: [
    {
      key: 'Serves',
      label: 'Serves',
      help: 'Offers its function to the element it points to: a service serves a process, a component serves another component, a node serves the software on it.',
      from: [
        'BusinessService',
        'ApplicationService',
        'Interface',
        'ApplicationComponent',
        'Node',
        'SystemSoftware',
      ],
      to: [
        'BusinessActor',
        'Role',
        'BusinessProcess',
        'ApplicationComponent',
        'ApplicationService',
      ],
      look: line('#495057', { end: 'open-arrow' }),
    },
    {
      key: 'Realises',
      label: 'Realises',
      help: 'Makes the service or interface real: a process realises a business service, a component realises an application service or interface.',
      from: ['BusinessProcess', 'ApplicationComponent', 'ApplicationService'],
      to: ['BusinessService', 'ApplicationService', 'Interface'],
      look: line('#495057', { style: 'dashed', end: 'triangle' }),
    },
    {
      key: 'AssignedTo',
      label: 'Assigned to',
      help: 'Who or what does the work or runs it: an actor fills a role, a role performs a process, a node runs software.',
      from: ['BusinessActor', 'Role', 'Node', 'SystemSoftware'],
      to: ['Role', 'BusinessProcess', 'ApplicationComponent', 'SystemSoftware'],
      look: line('#495057', { start: 'circle', end: 'arrow' }),
    },
    {
      key: 'Accesses',
      label: 'Accesses',
      help: 'The process, component or service reads or writes the data object.',
      from: ['BusinessProcess', 'ApplicationComponent', 'ApplicationService'],
      to: ['DataObject'],
      attributes: [choice('Access', ['Reads', 'Writes', 'Reads and writes'])],
      look: line('#1c7ed6', {
        style: 'dotted',
        end: 'open-arrow',
        label: 'Access',
      }),
    },
    {
      key: 'FlowsTo',
      label: 'Flows to',
      help: 'Something passes from one process or component to the next, such as an order.',
      from: ['BusinessProcess', 'ApplicationComponent'],
      to: ['BusinessProcess', 'ApplicationComponent'],
      attributes: [text('What', { help: 'What passes, such as "order".' })],
      look: line('#7048e8', { style: 'dashed', label: 'What' }),
    },
    {
      key: 'Triggers',
      label: 'Triggers',
      help: 'The actor or process starts the next process.',
      from: ['BusinessActor', 'BusinessProcess'],
      to: ['BusinessProcess'],
      look: line('#2f9e44', { end: 'triangle' }),
    },
    {
      key: 'ConnectedTo',
      label: 'Connected to',
      help: 'The node is connected to the network, or the two are linked.',
      from: ['Node', 'Network'],
      to: ['Node', 'Network'],
      look: line(TECHNOLOGY.border, { end: 'none' }),
    },
  ],
  modelTypes: [
    {
      key: 'Architecture',
      label: 'Enterprise architecture',
      help: 'The business, application and technology layers of an organisation and how they serve, realise and run each other.',
      views: [
        {
          key: 'Business',
          label: 'Business layer',
          classes: ['Layer', ...BUSINESS_CLASSES],
          relations: [
            'Serves',
            'Realises',
            'AssignedTo',
            'Triggers',
            'FlowsTo',
          ],
        },
        {
          key: 'Application',
          label: 'Application layer',
          classes: ['Layer', ...APPLICATION_CLASSES],
          relations: ['Serves', 'Realises', 'Accesses', 'FlowsTo'],
        },
        {
          key: 'Technology',
          label: 'Technology layer',
          classes: ['Layer', ...TECHNOLOGY_CLASSES],
          relations: ['Serves', 'AssignedTo', 'ConnectedTo'],
        },
      ],
      containers: {
        Layer: [
          ...BUSINESS_CLASSES,
          ...APPLICATION_CLASSES,
          ...TECHNOLOGY_CLASSES,
        ],
      },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        text('Architect'),
        formula(
          'Applications',
          "count(objects('ApplicationComponent'))",
          'number',
          'How many application components the model holds.',
        ),
        formula(
          'Processes',
          "count(objects('BusinessProcess'))",
          'number',
          'How many business processes the model holds.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'ApplicationComponent',
      tabs: [
        {
          label: 'Component',
          items: [
            'Name',
            { attribute: 'Description', control: 'textarea' },
            'Owner',
            'Users',
          ],
        },
        {
          label: 'Life cycle',
          items: [
            { attribute: 'Lifecycle', control: 'segmented' },
            { attribute: 'Hosting', control: 'select' },
            'Supports',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'online-ordering.mkmodel.json',
    id: 'mdl_onlineordering',
    name: 'Online ordering',
    modelType: 'Architecture',
    attributes: {
      Title: 'Online ordering',
      Organisation: 'A regional food wholesaler',
      Architect: 'Enterprise architect',
    },
    // The old warehouse system is to be retired but still serves picking, on purpose.
    intendedWarnings: 1,
    elements: [
      // Business layer.
      e(
        'lay_business',
        'Layer',
        20,
        20,
        { Name: 'Business', Kind: 'Business' },
        { w: 1300, h: 250 },
      ),
      e(
        'act_customer',
        'BusinessActor',
        80,
        90,
        { Name: 'Customer', Kind: 'Outside party' },
        { parent: 'lay_business' },
      ),
      e(
        'svc_ordering',
        'BusinessService',
        240,
        50,
        { Name: 'Online ordering', Consumers: 'Shops and restaurants' },
        { parent: 'lay_business' },
      ),
      e(
        'p_take',
        'BusinessProcess',
        260,
        160,
        { Name: 'Take order', Owner: 'Sales manager' },
        { parent: 'lay_business' },
      ),
      e(
        'p_pick',
        'BusinessProcess',
        560,
        160,
        { Name: 'Pick and pack', Owner: 'Warehouse manager' },
        { parent: 'lay_business' },
      ),
      e(
        'p_deliver',
        'BusinessProcess',
        860,
        160,
        { Name: 'Deliver order', Owner: 'Transport manager' },
        { parent: 'lay_business' },
      ),
      e(
        'role_picker',
        'Role',
        565,
        50,
        { Name: 'Order picker' },
        { parent: 'lay_business' },
      ),
      e(
        'act_warehouse',
        'BusinessActor',
        800,
        30,
        { Name: 'Warehouse team', Kind: 'Team' },
        { parent: 'lay_business' },
      ),
      // Application layer.
      e(
        'lay_app',
        'Layer',
        20,
        300,
        { Name: 'Application', Kind: 'Application' },
        { w: 1300, h: 250 },
      ),
      e(
        'as_orders',
        'ApplicationService',
        260,
        320,
        { Name: 'Order handling' },
        { parent: 'lay_app' },
      ),
      e(
        'ac_shop',
        'ApplicationComponent',
        60,
        430,
        {
          Name: 'Web shop',
          Owner: 'Head of e-commerce',
          Lifecycle: 'Invest',
          Hosting: 'Cloud',
          Users: 1200,
        },
        { parent: 'lay_app' },
      ),
      e(
        'if_api',
        'Interface',
        280,
        440,
        { Name: 'Order API', Direction: 'Inbound', Format: 'JSON over HTTPS' },
        { parent: 'lay_app' },
      ),
      e(
        'ac_orders',
        'ApplicationComponent',
        490,
        430,
        {
          Name: 'Order management',
          Owner: 'Head of sales operations',
          Lifecycle: 'Invest',
          Hosting: 'Cloud',
          Users: 60,
        },
        { parent: 'lay_app' },
      ),
      e(
        'ac_warehouse',
        'ApplicationComponent',
        860,
        430,
        {
          Name: 'Old warehouse system',
          Owner: 'Warehouse manager',
          Lifecycle: 'Retire',
          Hosting: 'On-premises',
          Users: 40,
        },
        { parent: 'lay_app' },
      ),
      e(
        'do_order',
        'DataObject',
        700,
        350,
        { Name: 'Order', Classification: 'Internal' },
        { parent: 'lay_app' },
      ),
      e(
        'do_stock',
        'DataObject',
        1110,
        430,
        { Name: 'Stock level', Classification: 'Internal' },
        { parent: 'lay_app' },
      ),
      // Technology layer.
      e(
        'lay_tech',
        'Layer',
        20,
        580,
        { Name: 'Technology', Kind: 'Technology' },
        { w: 1300, h: 230 },
      ),
      e(
        'n_cloud',
        'Node',
        260,
        610,
        {
          Name: 'Cloud hosting',
          Kind: 'Cloud service',
          Environment: 'Production',
        },
        { parent: 'lay_tech' },
      ),
      e(
        'ss_db',
        'SystemSoftware',
        490,
        610,
        { Name: 'Order database', Kind: 'Database', Version: '16' },
        { parent: 'lay_tech' },
      ),
      e(
        'n_server',
        'Node',
        860,
        610,
        {
          Name: 'Warehouse server',
          Kind: 'Physical server',
          Location: 'Main warehouse',
          Environment: 'Production',
        },
        { parent: 'lay_tech' },
      ),
      e(
        'net_internet',
        'Network',
        255,
        735,
        { Name: 'Internet', Kind: 'Internet' },
        { parent: 'lay_tech' },
      ),
      e(
        'net_lan',
        'Network',
        855,
        735,
        { Name: 'Warehouse network', Kind: 'Local network' },
        { parent: 'lay_tech' },
      ),
    ],
    connectors: [
      // Business.
      c('Triggers', 'act_customer', 'p_take'),
      c('Triggers', 'p_take', 'p_pick'),
      c('Triggers', 'p_pick', 'p_deliver'),
      c('Realises', 'p_take', 'svc_ordering'),
      c('Serves', 'svc_ordering', 'act_customer'),
      c('AssignedTo', 'act_warehouse', 'role_picker'),
      c('AssignedTo', 'role_picker', 'p_pick'),
      // Application.
      c('Serves', 'as_orders', 'p_take'),
      c('Realises', 'ac_orders', 'as_orders'),
      c('Realises', 'ac_orders', 'if_api'),
      c('Serves', 'if_api', 'ac_shop'),
      c('Serves', 'ac_warehouse', 'p_pick'),
      c('FlowsTo', 'ac_orders', 'ac_warehouse', { What: 'Orders to pick' }),
      c('Accesses', 'ac_orders', 'do_order', { Access: 'Writes' }),
      c('Accesses', 'ac_warehouse', 'do_stock', { Access: 'Reads and writes' }),
      // Technology.
      c('AssignedTo', 'n_cloud', 'ac_shop'),
      c('AssignedTo', 'n_cloud', 'ac_orders'),
      c('Serves', 'ss_db', 'ac_orders'),
      c('AssignedTo', 'n_cloud', 'ss_db'),
      c('AssignedTo', 'n_server', 'ac_warehouse'),
      c('ConnectedTo', 'n_cloud', 'net_internet'),
      c('ConnectedTo', 'n_server', 'net_lan'),
    ],
  },
};
