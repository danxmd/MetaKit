import type { KitId } from '@metakit-app/core';
import {
  choice,
  date,
  formula,
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
 * Data mesh and data products: domains own data products, which take data in through input ports
 * and share it through output ports, each covered by a data contract with a schema, a service
 * level and a version. Consumers read from output ports; a self-serve platform offers the shared
 * services, and global policies are enforced by it.
 */

const PRODUCT_FILL = {
  by: 'Status',
  values: {
    Idea: '#e9ecef',
    'In development': '#fff3bf',
    Live: '#b2f2bb',
    Retired: '#dee2e6',
  },
  fallback: '#a5d8ff',
};

const CONTRACT_FILL = {
  by: 'Status',
  values: { Draft: '#fff3bf', Active: '#d3f9d8', Deprecated: '#e9ecef' },
  fallback: '#fff9db',
};

/** Containers are see-through, so the lines between the objects inside them show. */
const CLEAR = '#ffffff00';

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

/**
 * One domain with its product: input ports on the left, the product in the middle and the
 * output port, with its contract below it, on the right.
 */
function domain(
  id: string,
  x: number,
  y: number,
  values: { Name: string; DomainOwner: string; Description: string },
  inputs: [string, Record<string, string>][],
  product: [string, Record<string, string>],
  output: [string, Record<string, string>],
  contract?: [string, Record<string, string | number>],
): SampleElement[] {
  const inside = { parent: id };
  return [
    e(id, 'DataDomain', x, y, values, { w: 600, h: 250 }),
    ...inputs.map(([pid, v], i) =>
      e(pid, 'InputPort', x + 20, y + 60 + i * 90, v, inside),
    ),
    e(product[0], 'DataProduct', x + 210, y + 85, product[1], inside),
    e(output[0], 'OutputPort', x + 420, y + 60, output[1], inside),
    ...(contract
      ? [e(contract[0], 'DataContract', x + 435, y + 130, contract[1], inside)]
      : []),
  ];
}

export const dataMesh: KitSpec = {
  folder: 'data-mesh',
  id: 'kit_datamesh' as KitId,
  name: 'Data mesh and data products',
  catalog: { keys: ['DataDomain', 'DataProduct', 'SourceSystem', 'Policy'] },
  classes: [
    {
      key: 'InputPort',
      label: 'Input port',
      help: 'Where a data product takes data in: from a source system or from the output port of another product.',
      look: look('pill', {
        fill: '#e7f5ff',
        border: '#1c7ed6',
        subtitle: 'Mechanism',
        width: 140,
        height: 44,
      }),
      attributes: [
        long('Description'),
        choice('Mechanism', [
          'Batch',
          'Streaming',
          'API',
          'Change data capture',
          'Files',
        ]),
        text('Format', { help: 'Such as tables, files or events.' }),
      ],
      constraints: [
        {
          id: 'k_inputport_product',
          formula: "count(outgoing('Feeds')) > 0",
          message:
            '= \'Input port "\' + Name + \'" feeds no data product: connect it to its product with "Feeds".\'',
        },
      ],
    },
    {
      key: 'OutputPort',
      label: 'Output port',
      help: 'Where a data product shares its data with consumers, such as a table, an API or an event stream. A data contract says what consumers can rely on.',
      look: look('pill', {
        fill: '#d0ebff',
        border: '#1864ab',
        borderWidth: 2,
        subtitle: 'Interface',
        width: 150,
        height: 44,
      }),
      attributes: [
        long('Description'),
        choice('Interface', [
          'Table',
          'Files',
          'API',
          'Event stream',
          'Query endpoint',
        ]),
        text('Address', {
          help: 'Where consumers find it, such as a table name or a web address.',
        }),
        formula(
          'Consumers',
          "count(outgoing('FlowsTo'))",
          'number',
          'How many consumers and input ports of other products read from it.',
        ),
        formula(
          'Contracts',
          "count(outgoing('HasContract'))",
          'number',
          'How many data contracts cover it.',
        ),
        formula(
          'ContractVersion',
          "join(outgoing('HasContract').Version, ', ')",
          'text',
          'The version of its contract.',
        ),
      ],
    },
    {
      key: 'DataContract',
      label: 'Data contract',
      help: 'What the owner of a data product promises the consumers of an output port: the schema, the service level and how changes are announced.',
      look: look('document', {
        fill: CONTRACT_FILL,
        border: '#f08c00',
        icon: 'document',
        subtitle: 'VersionLabel',
        width: 120,
        height: 90,
      }),
      attributes: [
        long('Description'),
        text('Version', {
          pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$',
          help: 'Major, minor and patch, such as 2.1.0. Raise the major number for a change that breaks consumers.',
        }),
        choice('Status', ['Draft', 'Active', 'Deprecated'], {
          default: 'Draft',
        }),
        long('Schema', {
          help: 'The fields and their types, one per line, such as "order_id: text, key".',
        }),
        text('Freshness', {
          help: 'How up to date the data is, such as "updated by 06:00 every day".',
        }),
        num('Availability', {
          unit: '%',
          min: 0,
          max: 100,
          help: 'The share of time the output port can be read, such as 99.5.',
        }),
        long('QualityExpectations', {
          help: 'The quality checks consumers can rely on, such as "no order without a customer".',
        }),
        text('ChangeNotice', {
          label: 'Notice of changes',
          help: 'How long consumers are told in advance about a change that breaks them, such as "30 days".',
        }),
        date('EffectiveDate'),
        formula(
          'VersionLabel',
          "Version ? 'Version ' + Version : null",
          'text',
          'The version, shown under the name.',
        ),
        formula(
          'HasServiceLevel',
          '!isEmpty(Freshness) || Availability != null',
          'boolean',
          'Yes when the contract promises a freshness or an availability.',
        ),
      ],
      constraints: [
        {
          id: 'k_contract_sla',
          formula: 'HasServiceLevel',
          message:
            "= 'Data contract \"' + Name + '\" has no service level: give it a freshness or an availability.'",
        },
      ],
    },
    {
      key: 'Consumer',
      label: 'Consumer',
      help: 'A team, application, report or model that uses data from an output port.',
      look: look('box', {
        fill: '#f3f0ff',
        border: '#6741d9',
        icon: 'person',
        subtitle: 'ConsumerType',
        width: 160,
        height: 70,
      }),
      attributes: [
        choice(
          'ConsumerType',
          ['Team', 'Application', 'Report', 'ML model', 'Partner'],
          { label: 'Type' },
        ),
        long('Purpose', { help: 'What the consumer uses the data for.' }),
      ],
    },
    {
      key: 'SelfServePlatform',
      label: 'Self-serve platform',
      help: 'The shared data platform that domain teams use to build, run and share their data products without a central team. Place its services inside it.',
      look: look('container', {
        fill: CLEAR,
        border: '#0c8599',
        subtitle: 'PlatformTeam',
        width: 1260,
        height: 150,
      }),
      attributes: [text('PlatformTeam'), long('Description')],
    },
    {
      key: 'PlatformService',
      label: 'Platform service',
      help: 'One service of the self-serve platform, such as storage, pipelines, the data catalog or access control. Technology is free text.',
      look: look('rounded', {
        fill: '#c3fae8',
        border: '#0c8599',
        icon: 'gear',
        subtitle: 'Category',
        width: 170,
        height: 60,
      }),
      attributes: [
        long('Description'),
        choice('Category', [
          'Storage',
          'Compute',
          'Pipelines',
          'Catalog and discovery',
          'Access control',
          'Monitoring',
          'Policy enforcement',
        ]),
        text('Technology'),
        formula(
          'UsedBy',
          "count(incoming('BuiltOn'))",
          'number',
          'How many data products are built on it.',
        ),
      ],
    },
  ],
  amend: {
    DataDomain: {
      help: 'An area of the business that owns its data and the data products made from it, such as sales or customer. Place its products, ports and contracts inside it.',
      look: look('container', {
        fill: CLEAR,
        border: '#1c7ed6',
        width: 600,
        height: 250,
      }),
      attributes: [
        choice(
          'DomainType',
          ['Source-aligned', 'Aggregate', 'Consumer-aligned'],
          {
            label: 'Type',
            help: 'Source-aligned domains share the data of their own systems; aggregate and consumer-aligned ones combine it for a use.',
          },
        ),
      ],
    },
    DataProduct: {
      help: 'Data packaged for others to use, owned by a domain team. It takes data in through input ports and shares it through output ports covered by data contracts.',
      remove: ['SLA'],
      attributes: [
        choice(
          'ProductType',
          ['Source-aligned', 'Aggregate', 'Consumer-aligned'],
          {
            label: 'Type',
          },
        ),
        choice('Classification', [
          'Public',
          'Internal',
          'Confidential',
          'Restricted',
        ]),
        text('Version'),
        formula(
          'InputPorts',
          "count(incoming('Feeds'))",
          'number',
          'How many input ports feed it.',
        ),
        formula(
          'OutputPorts',
          "count(outgoing('Publishes'))",
          'number',
          'How many output ports it publishes through.',
        ),
        formula(
          'Consumers',
          "sum(outgoing('Publishes').Consumers)",
          'number',
          'How many consumers and other products read from its output ports.',
        ),
        formula(
          'Contracts',
          "sum(outgoing('Publishes').Contracts)",
          'number',
          'How many data contracts cover its output ports.',
        ),
      ],
      look: look('hexagon', {
        fill: PRODUCT_FILL,
        border: '#1864ab',
        borderWidth: 2,
        subtitle: 'Owner',
        width: 160,
        height: 80,
      }),
      constraints: [
        {
          id: 'k_product_owner',
          formula: '!isEmpty(Owner)',
          message: "= 'Data product \"' + Name + '\" has no owner.'",
        },
        {
          id: 'k_product_contract',
          formula: 'Contracts > 0',
          message:
            '= \'Data product "\' + Name + \'" has no data contract: connect a contract to one of its output ports with "Has contract".\'',
        },
      ],
    },
    Policy: {
      help: 'A rule every data product must follow, such as how personal data is protected or how products are named. A global policy applies to all domains; the platform can enforce it automatically.',
      attributes: [
        choice('Scope', ['Global', 'Domain'], {
          help: 'Global policies apply to every data product; domain policies only to the products of one domain.',
        }),
        formula(
          'EnforcedBy',
          "join(incoming('Enforces').Name, ', ')",
          'text',
          'The platform services that enforce it automatically.',
        ),
      ],
    },
  },
  relations: [
    {
      key: 'Feeds',
      label: 'Feeds',
      help: 'The input port brings data into the data product.',
      from: ['InputPort'],
      to: ['DataProduct'],
      look: line('#1c7ed6'),
    },
    {
      key: 'Publishes',
      label: 'Publishes',
      help: 'The data product shares its data through the output port.',
      from: ['DataProduct'],
      to: ['OutputPort'],
      look: line('#1864ab'),
    },
    {
      key: 'FlowsTo',
      label: 'Flows to',
      help: 'Data moves from a source system or an output port to an input port of another product, or to a consumer.',
      from: ['SourceSystem', 'OutputPort'],
      to: ['InputPort', 'Consumer'],
      attributes: [text('Frequency')],
      look: line('#1c7ed6', { style: 'dashed', label: 'Frequency' }),
    },
    {
      key: 'HasContract',
      label: 'Has contract',
      help: 'The data contract covers what the output port shares.',
      from: ['OutputPort'],
      to: ['DataContract'],
      look: line('#f08c00', { start: 'diamond', end: 'none' }),
    },
    {
      key: 'BuiltOn',
      label: 'Built on',
      help: 'The data product uses the platform service.',
      from: ['DataProduct'],
      to: ['PlatformService'],
      look: line('#0c8599', { style: 'dotted' }),
    },
    {
      key: 'Enforces',
      label: 'Enforces',
      help: 'The platform service checks or applies the policy automatically, for every product that uses it.',
      from: ['PlatformService'],
      to: ['Policy'],
      look: line('#e03131', { style: 'dashed', end: 'open-arrow' }),
    },
  ],
  modelTypes: [
    {
      key: 'DataMesh',
      label: 'Data mesh',
      help: 'Domains with their data products, input and output ports, data contracts and consumers, the self-serve platform and the policies that govern them.',
      views: [
        {
          key: 'Products',
          label: 'Products and ports',
          classes: [
            'DataDomain',
            'DataProduct',
            'InputPort',
            'OutputPort',
            'DataContract',
            'SourceSystem',
            'Consumer',
          ],
          relations: ['Feeds', 'Publishes', 'FlowsTo', 'HasContract'],
        },
        {
          key: 'Governance',
          label: 'Platform and governance',
          classes: [
            'SelfServePlatform',
            'PlatformService',
            'Policy',
            'DataProduct',
          ],
          relations: ['BuiltOn', 'Enforces', 'GovernedBy'],
        },
      ],
      containers: {
        DataDomain: ['DataProduct', 'InputPort', 'OutputPort', 'DataContract'],
        SelfServePlatform: ['PlatformService'],
      },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        formula(
          'DataProducts',
          "count(objects('DataProduct'))",
          'number',
          'How many data products the model holds.',
        ),
        formula(
          'DataContracts',
          "count(objects('DataContract'))",
          'number',
          'How many data contracts the model holds.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'DataProduct',
      tabs: [
        {
          label: 'Product',
          items: [
            'Name',
            'Owner',
            { attribute: 'ProductType', control: 'select' },
            { attribute: 'Status', control: 'segmented' },
            'Classification',
            'Version',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Ports and use',
          items: ['InputPorts', 'OutputPorts', 'Consumers', 'Contracts'],
        },
      ],
      showRelations: true,
    },
    {
      class: 'DataContract',
      tabs: [
        {
          label: 'Contract',
          items: [
            'Name',
            'Version',
            { attribute: 'Status', control: 'segmented' },
            'EffectiveDate',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Service level',
          items: [
            'Freshness',
            'Availability',
            'ChangeNotice',
            'HasServiceLevel',
          ],
        },
        {
          label: 'Schema and quality',
          items: [
            { attribute: 'Schema', control: 'textarea' },
            { attribute: 'QualityExpectations', control: 'textarea' },
          ],
        },
      ],
    },
  ],
  sample: {
    file: 'retail-data-mesh.mkmodel.json',
    id: 'mdl_retaildatamesh',
    name: 'Retail data mesh',
    modelType: 'DataMesh',
    attributes: {
      Title: 'Retail data mesh',
      Organisation: 'A fashion retailer',
    },
    // "Stock levels" has no data contract yet, on purpose.
    intendedWarnings: 1,
    elements: [
      e('src_pos', 'SourceSystem', 40, 90, {
        Name: 'Till system',
        Technology: 'Store point of sale',
        Hosting: 'On-premises',
      }),
      e('src_web', 'SourceSystem', 40, 180, {
        Name: 'Online shop',
        Technology: 'Web shop platform',
        Hosting: 'Software as a service',
      }),
      e('src_crm', 'SourceSystem', 40, 470, {
        Name: 'Customer service system',
        Hosting: 'Software as a service',
      }),
      e('src_wms', 'SourceSystem', 40, 670, {
        Name: 'Warehouse system',
        Hosting: 'On-premises',
      }),
      ...domain(
        'dom_sales',
        240,
        40,
        {
          Name: 'Sales',
          DomainOwner: 'Head of sales operations',
          Description: 'Orders from the stores and the online shop.',
        },
        [
          ['in_pos', { Name: 'Store sales', Mechanism: 'Batch' }],
          ['in_web', { Name: 'Web orders', Mechanism: 'Streaming' }],
        ],
        [
          'dp_orders',
          {
            Name: 'Orders',
            Owner: 'Sales data team',
            ProductType: 'Source-aligned',
            Status: 'Live',
            Classification: 'Internal',
            Version: '2.1.0',
          },
        ],
        [
          'out_orders',
          { Name: 'Orders table', Interface: 'Table', Address: 'sales.orders' },
        ],
        [
          'ct_orders',
          {
            Name: 'Orders contract',
            Version: '2.1.0',
            Status: 'Active',
            Freshness: 'Updated by 06:00 every day',
            Availability: 99.5,
            ChangeNotice: '30 days',
            Schema:
              'order_id: text, key\ncustomer_id: text\nstore_id: text\nordered_at: date and time\nnet_amount: decimal',
          },
        ],
      ),
      ...domain(
        'dom_customer',
        240,
        330,
        {
          Name: 'Customer',
          DomainOwner: 'Head of customer',
          Description: 'Who our customers are and how they buy.',
        },
        [
          ['in_orders', { Name: 'Order history', Mechanism: 'Batch' }],
          ['in_crm', { Name: 'Contacts', Mechanism: 'API' }],
        ],
        [
          'dp_profile',
          {
            Name: 'Customer profile',
            Owner: 'Customer data team',
            ProductType: 'Aggregate',
            Status: 'Live',
            Classification: 'Confidential',
            Version: '1.4.0',
          },
        ],
        [
          'out_profile',
          {
            Name: 'Profiles table',
            Interface: 'Table',
            Address: 'customer.profiles',
          },
        ],
        [
          'ct_profile',
          {
            Name: 'Profile contract',
            Version: '1.4.0',
            Status: 'Active',
            Freshness: 'Updated every 4 hours',
            Availability: 99,
            ChangeNotice: '60 days',
          },
        ],
      ),
      ...domain(
        'dom_supply',
        240,
        620,
        {
          Name: 'Supply chain',
          DomainOwner: 'Head of logistics',
          Description: 'Stock in the warehouse and in the stores.',
        },
        [
          [
            'in_wms',
            { Name: 'Stock movements', Mechanism: 'Change data capture' },
          ],
        ],
        [
          'dp_stock',
          {
            Name: 'Stock levels',
            Owner: 'Logistics data team',
            ProductType: 'Source-aligned',
            Status: 'In development',
            Classification: 'Internal',
          },
        ],
        ['out_stock', { Name: 'Stock events', Interface: 'Event stream' }],
      ),
      ...domain(
        'dom_marketing',
        900,
        330,
        {
          Name: 'Marketing',
          DomainOwner: 'Head of marketing',
          Description: 'Segments and audiences for campaigns.',
        },
        [
          ['in_profiles', { Name: 'Profiles', Mechanism: 'Batch' }],
          ['in_sales', { Name: 'Recent orders', Mechanism: 'Batch' }],
        ],
        [
          'dp_segments',
          {
            Name: 'Customer segments',
            Owner: 'Marketing analytics team',
            ProductType: 'Consumer-aligned',
            Status: 'Live',
            Classification: 'Confidential',
            Version: '1.0.0',
          },
        ],
        ['out_segments', { Name: 'Segments API', Interface: 'API' }],
        [
          'ct_segments',
          {
            Name: 'Segments contract',
            Version: '1.0.0',
            Status: 'Draft',
            Freshness: 'Updated every Monday',
            ChangeNotice: '14 days',
          },
        ],
      ),
      e('con_finance', 'Consumer', 1600, 85, {
        Name: 'Finance reporting',
        ConsumerType: 'Report',
        Purpose: 'Daily revenue and margin.',
      }),
      e('con_campaigns', 'Consumer', 1600, 380, {
        Name: 'Campaign planning',
        ConsumerType: 'Team',
        Purpose: 'Choosing who receives which offer.',
      }),
      e('con_replenish', 'Consumer', 1600, 670, {
        Name: 'Store replenishment',
        ConsumerType: 'Application',
        Purpose: 'Ordering stock for the stores.',
      }),
      e('pol_naming', 'Policy', 920, 680, {
        Name: 'Product naming and versions',
        Scope: 'Global',
        Owner: 'Data governance council',
      }),
      e('pol_personal', 'Policy', 1150, 680, {
        Name: 'Personal data protection',
        Scope: 'Global',
        Owner: 'Data protection officer',
      }),
      e(
        'platform',
        'SelfServePlatform',
        240,
        910,
        {
          Name: 'Self-serve data platform',
          PlatformTeam: 'Data platform team',
        },
        { w: 1260, h: 150 },
      ),
      ...(
        [
          ['svc_storage', 'Storage', 'Storage'],
          ['svc_pipelines', 'Pipelines', 'Pipelines'],
          ['svc_catalog', 'Data catalog', 'Catalog and discovery'],
          ['svc_access', 'Access control', 'Access control'],
          ['svc_monitoring', 'Quality monitoring', 'Monitoring'],
        ] as const
      ).map(([id, name, category], i) =>
        e(
          id,
          'PlatformService',
          260 + i * 245,
          970,
          { Name: name, Category: category },
          { parent: 'platform' },
        ),
      ),
    ],
    connectors: [
      c('FlowsTo', 'src_pos', 'in_pos', { Frequency: 'Nightly' }),
      c('FlowsTo', 'src_web', 'in_web', { Frequency: 'Live' }),
      c('FlowsTo', 'src_crm', 'in_crm'),
      c('FlowsTo', 'src_wms', 'in_wms', { Frequency: 'Live' }),
      c('Feeds', 'in_pos', 'dp_orders'),
      c('Feeds', 'in_web', 'dp_orders'),
      c('Feeds', 'in_orders', 'dp_profile'),
      c('Feeds', 'in_crm', 'dp_profile'),
      c('Feeds', 'in_wms', 'dp_stock'),
      c('Feeds', 'in_profiles', 'dp_segments'),
      c('Feeds', 'in_sales', 'dp_segments'),
      c('Publishes', 'dp_orders', 'out_orders'),
      c('Publishes', 'dp_profile', 'out_profile'),
      c('Publishes', 'dp_stock', 'out_stock'),
      c('Publishes', 'dp_segments', 'out_segments'),
      c('HasContract', 'out_orders', 'ct_orders'),
      c('HasContract', 'out_profile', 'ct_profile'),
      c('HasContract', 'out_segments', 'ct_segments'),
      c('FlowsTo', 'out_orders', 'in_orders', { Frequency: 'Daily' }),
      c('FlowsTo', 'out_orders', 'in_sales', { Frequency: 'Weekly' }),
      c('FlowsTo', 'out_orders', 'con_finance', { Frequency: 'Daily' }),
      c('FlowsTo', 'out_profile', 'in_profiles', { Frequency: 'Weekly' }),
      c('FlowsTo', 'out_segments', 'con_campaigns'),
      c('FlowsTo', 'out_stock', 'con_replenish', { Frequency: 'Live' }),
      c('GovernedBy', 'dp_profile', 'pol_personal'),
      c('GovernedBy', 'dp_segments', 'pol_personal'),
      c('Enforces', 'svc_access', 'pol_personal'),
      c('Enforces', 'svc_catalog', 'pol_naming'),
      c('BuiltOn', 'dp_stock', 'svc_pipelines'),
    ],
  },
};
