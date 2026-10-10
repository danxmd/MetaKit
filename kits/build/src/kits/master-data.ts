import type { KitId } from '@metakit-app/core';
import {
  choice,
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
 * Master data management: master data domains hold master entities (the golden records), with
 * the match rules that find duplicates and the survivorship rules that decide which value wins.
 * Source systems supply records, an MDM hub of a given style manages the golden records and sends
 * them to the systems that use them, and data stewards look after them.
 */

/** Containers are see-through, so the lines between the objects inside them show. */
const CLEAR = '#ffffff00';

const HUB_FILL = {
  by: 'Style',
  values: {
    Registry: '#e7f5ff',
    Consolidation: '#d0ebff',
    Coexistence: '#a5d8ff',
    Centralised: '#74c0fc',
  },
  fallback: '#e9ecef',
};

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

const fields = (...names: [string, string, boolean?][]) =>
  names.map(([name, type, key]) => ({
    name,
    type,
    key: key ?? false,
    nullable: !key,
  }));

export const masterData: KitSpec = {
  folder: 'master-data',
  id: 'kit_masterdata' as KitId,
  name: 'Master data management',
  catalog: {
    keys: ['DataEntity', 'SourceSystem', 'Application', 'DataSteward'],
  },
  classes: [
    {
      key: 'MasterDataDomain',
      label: 'Master data domain',
      help: 'A kind of master data with its own owner, such as customer, product or supplier. Place its master entities and their rules inside it.',
      look: look('container', {
        fill: CLEAR,
        border: '#1c7ed6',
        width: 520,
        height: 330,
      }),
      attributes: [long('Description'), text('Owner')],
    },
    {
      key: 'MatchRule',
      label: 'Match rule',
      help: 'How records from different sources are recognised as the same thing: which attributes are compared, how, and from which score two records are merged.',
      look: look('rounded', {
        fill: '#fff3bf',
        border: '#f08c00',
        icon: 'check',
        subtitle: 'Bands',
        width: 200,
        height: 70,
      }),
      attributes: [
        long('Description'),
        text('ComparedAttributes', {
          help: 'The attributes compared, such as "name, date of birth and postcode".',
        }),
        choice('MatchType', ['Exact', 'Fuzzy', 'Probabilistic'], {
          label: 'Type',
        }),
        num('MatchThreshold', {
          label: 'Match from',
          unit: '%',
          min: 0,
          max: 100,
          help: 'From this score two records are a possible match, which a steward reviews.',
        }),
        num('AutoMergeFrom', {
          label: 'Merge without review from',
          unit: '%',
          min: 0,
          max: 100,
          help: 'From this score two records are merged without review.',
        }),
        formula(
          'Bands',
          "MatchThreshold == null || AutoMergeFrom == null ? null : MatchThreshold == AutoMergeFrom ? 'Merge from ' + text(AutoMergeFrom) + '%' : 'Review from ' + text(MatchThreshold) + '%, merge from ' + text(AutoMergeFrom) + '%'",
          'text',
          'The scores that go to review and the scores that merge, shown under the name.',
        ),
      ],
      constraints: [
        {
          id: 'k_match_bands',
          formula:
            'MatchThreshold == null || AutoMergeFrom == null || AutoMergeFrom >= MatchThreshold',
          message:
            "= 'Match rule \"' + Name + '\" merges without review below the score at which it starts to match.'",
        },
      ],
    },
    {
      key: 'SurvivorshipRule',
      label: 'Survivorship rule',
      help: 'Which value wins when sources disagree, for some attributes of the golden record: the most trusted source, the most recent value, the most complete one, the most frequent one, or the steward decides.',
      look: look('rounded', {
        fill: '#e5dbff',
        border: '#6741d9',
        icon: 'star',
        subtitle: 'Strategy',
        width: 200,
        height: 70,
      }),
      attributes: [
        long('Description'),
        text('AppliesTo', {
          help: 'The attributes it decides, such as "address and phone".',
        }),
        choice('Strategy', [
          'Most trusted source',
          'Most recent',
          'Most complete',
          'Most frequent',
          'Steward decides',
        ]),
        text('SourceOrder', {
          help: 'For "Most trusted source": the sources from the most to the least trusted.',
        }),
      ],
    },
    {
      key: 'MDMHub',
      label: 'MDM hub',
      help: 'Where the golden records are managed. Its style says how it works with the sources: a registry only links them, consolidation copies them for reporting, coexistence sends golden records back to the sources, and a centralised hub is where master data is created.',
      look: look('box', {
        fill: HUB_FILL,
        border: '#1864ab',
        borderWidth: 2,
        icon: 'database',
        subtitle: 'Style',
        width: 170,
        height: 70,
      }),
      attributes: [
        long('Description'),
        choice(
          'Style',
          ['Registry', 'Consolidation', 'Coexistence', 'Centralised'],
          {
            help: 'Registry: an index that links the records in the sources. Consolidation: a golden copy for reporting. Coexistence: golden records are sent back to the sources. Centralised: master data is created in the hub.',
          },
        ),
        text('Technology', { help: 'As free text.' }),
        formula(
          'SendsBack',
          "Style == 'Coexistence' || Style == 'Centralised'",
          'boolean',
          'Yes for the styles that send golden records to other systems.',
          { label: 'Sends golden records out' },
        ),
        formula(
          'Entities',
          "count(incoming('ManagedIn'))",
          'number',
          'How many master entities it manages.',
        ),
      ],
      constraints: [
        {
          id: 'k_hub_distributes',
          formula: "!SendsBack || count(outgoing('Distributes')) > 0",
          message:
            "= 'MDM hub \"' + Name + '\" is of the style ' + Style + ' but sends golden records to no system: connect it with \"Distributes to\".'",
        },
      ],
    },
  ],
  amend: {
    DataEntity: {
      label: 'Master entity',
      help: 'One kind of master data, such as Customer or Product, whose golden records combine the records of several sources. Fields lists the attributes of the golden record.',
      attributes: [
        int('SourceRecords', {
          min: 0,
          help: 'How many records all sources hold together.',
        }),
        int('GoldenRecords', {
          min: 0,
          help: 'How many golden records remain after matching and merging.',
        }),
        formula(
          'DuplicateShare',
          'SourceRecords == null || GoldenRecords == null || SourceRecords == 0 ? null : round((SourceRecords - GoldenRecords) / SourceRecords * 100, 1)',
          'number',
          'The share of source records that were duplicates, in percent.',
          { label: 'Duplicates (%)' },
        ),
        formula(
          'Sources',
          "count(incoming('Supplies'))",
          'number',
          'How many source systems supply records.',
        ),
        formula(
          'MatchRules',
          "count(outgoing('MatchedBy'))",
          'number',
          'How many match rules it uses.',
        ),
        formula(
          'SurvivorshipRules',
          "count(outgoing('MergedBy'))",
          'number',
          'How many survivorship rules it uses.',
        ),
        formula(
          'Hub',
          "join(outgoing('ManagedIn').Name, ', ')",
          'text',
          'The MDM hub that manages it.',
        ),
        formula(
          'Steward',
          "join(incoming('Stewards').Name, ', ')",
          'text',
          'The data stewards who look after it.',
        ),
      ],
      look: look('header-box', {
        fill: '#a5d8ff',
        border: '#1c7ed6',
        icon: 'star',
        fields: ['Sources', 'DuplicateShare', 'Steward'],
        width: 190,
      }),
      constraints: [
        {
          id: 'k_master_match',
          formula: 'Sources < 2 || MatchRules > 0',
          message:
            "= 'Master entity \"' + Name + '\" has ' + text(Sources) + ' sources but no match rule to find duplicates.'",
        },
        {
          id: 'k_master_survivorship',
          formula: 'Sources < 2 || SurvivorshipRules > 0',
          message:
            "= 'Master entity \"' + Name + '\" has ' + text(Sources) + ' sources but no survivorship rule to decide which value wins.'",
        },
        {
          id: 'k_master_steward',
          formula: '!isEmpty(Steward)',
          message:
            '= \'Master entity "\' + Name + \'" has no data steward: connect one with "Stewards".\'',
        },
        {
          id: 'k_master_counts',
          formula:
            'SourceRecords == null || GoldenRecords == null || GoldenRecords <= SourceRecords',
          message:
            "= 'Master entity \"' + Name + '\" has more golden records than source records.'",
        },
      ],
    },
    SourceSystem: {
      help: 'A system that creates or changes master data and supplies records to the golden record.',
      attributes: [
        int('Records', {
          min: 0,
          help: 'How many master data records it holds.',
        }),
      ],
    },
    Application: {
      help: 'A system that uses golden records, such as billing or a customer portal.',
    },
  },
  relations: [
    {
      key: 'Supplies',
      label: 'Supplies',
      help: 'The source system sends its records to the master entity. Trust says how much its values are trusted when sources disagree: 1 is the most trusted.',
      from: ['SourceSystem'],
      to: ['DataEntity'],
      attributes: [
        int('Trust', { min: 1, help: '1 for the most trusted source.' }),
        formula(
          'TrustText',
          "Trust == null ? null : 'trust ' + text(Trust)",
          'text',
          'The trust rank, shown on the line.',
        ),
      ],
      look: line('#1c7ed6', { label: 'TrustText' }),
    },
    {
      key: 'MatchedBy',
      label: 'Matched by',
      help: 'The match rule finds the duplicates of the master entity.',
      from: ['DataEntity'],
      to: ['MatchRule'],
      look: line('#f08c00', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'MergedBy',
      label: 'Merged by',
      help: 'The survivorship rule decides which values the golden record keeps.',
      from: ['DataEntity'],
      to: ['SurvivorshipRule'],
      look: line('#6741d9', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'ManagedIn',
      label: 'Managed in',
      help: 'The golden records of the master entity are kept in the MDM hub.',
      from: ['DataEntity'],
      to: ['MDMHub'],
      look: line('#1864ab', { end: 'triangle' }),
    },
    {
      key: 'Distributes',
      label: 'Distributes to',
      help: 'The hub sends golden records to the system.',
      from: ['MDMHub'],
      to: ['Application', 'SourceSystem'],
      attributes: [text('Frequency')],
      look: line('#2f9e44', { label: 'Frequency' }),
    },
  ],
  amendRelations: {
    Stewards: { to: ['MasterDataDomain'] },
  },
  modelTypes: [
    {
      key: 'MasterData',
      label: 'Master data management',
      help: 'Master data domains with their master entities, match and survivorship rules, the source systems that supply them, the MDM hubs that manage them, the systems that use them and their stewards.',
      views: [
        {
          key: 'Rules',
          label: 'Golden records and rules',
          classes: [
            'MasterDataDomain',
            'DataEntity',
            'MatchRule',
            'SurvivorshipRule',
            'DataSteward',
          ],
          relations: ['MatchedBy', 'MergedBy', 'Stewards'],
        },
        {
          key: 'Systems',
          label: 'Systems and hubs',
          classes: ['SourceSystem', 'DataEntity', 'MDMHub', 'Application'],
          relations: ['Supplies', 'ManagedIn', 'Distributes'],
        },
      ],
      containers: {
        MasterDataDomain: [
          'DataEntity',
          'MatchRule',
          'SurvivorshipRule',
          'DataSteward',
        ],
      },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        formula(
          'MasterEntities',
          "count(objects('DataEntity'))",
          'number',
          'How many master entities the model holds.',
        ),
        formula(
          'GoldenRecords',
          "sum(objects('DataEntity').GoldenRecords)",
          'number',
          'The golden records of all master entities.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'DataEntity',
      tabs: [
        {
          label: 'Master entity',
          items: [
            'Name',
            { attribute: 'Description', control: 'textarea' },
            'Hub',
            'Steward',
            'Fields',
          ],
        },
        {
          label: 'Records',
          items: [
            'SourceRecords',
            'GoldenRecords',
            'DuplicateShare',
            'Sources',
            'MatchRules',
            'SurvivorshipRules',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'manufacturer-mdm.mkmodel.json',
    id: 'mdl_manufacturermdm',
    name: 'Customer, product and supplier master data',
    modelType: 'MasterData',
    attributes: {
      Title: 'Customer, product and supplier master data',
      Organisation: 'A maker of industrial pumps',
    },
    // "Supplier" has no data steward yet, on purpose.
    intendedWarnings: 1,
    elements: [
      e('src_crm', 'SourceSystem', 40, 80, {
        Name: 'Sales system',
        Records: 410000,
        Hosting: 'Software as a service',
      }),
      e('src_orders', 'SourceSystem', 40, 180, {
        Name: 'Order management',
        Records: 260000,
        Hosting: 'On-premises',
      }),
      e('src_service', 'SourceSystem', 40, 280, {
        Name: 'Field service system',
        Records: 90000,
        Hosting: 'Cloud',
      }),
      e('src_design', 'SourceSystem', 40, 530, {
        Name: 'Product design system',
        Records: 38000,
        Hosting: 'On-premises',
      }),
      e('src_erp', 'SourceSystem', 40, 760, {
        Name: 'Purchasing system',
        Records: 52000,
        Hosting: 'On-premises',
      }),
      e('src_portal', 'SourceSystem', 40, 1030, {
        Name: 'Supplier portal',
        Records: 6400,
        Hosting: 'Software as a service',
      }),
      // Customer
      e(
        'dom_customer',
        'MasterDataDomain',
        260,
        20,
        { Name: 'Customer', Owner: 'Head of sales operations' },
        { w: 520, h: 390 },
      ),
      e(
        'customer',
        'DataEntity',
        290,
        90,
        {
          Name: 'Customer',
          SourceRecords: 760000,
          GoldenRecords: 512000,
          Fields: fields(
            ['Customer number', 'Identifier', true],
            ['Legal name', 'Text'],
            ['Tax number', 'Text'],
            ['Billing address', 'Text'],
            ['Industry', 'Code'],
          ),
        },
        { parent: 'dom_customer' },
      ),
      e(
        'stw_customer',
        'DataSteward',
        560,
        270,
        { Name: 'Customer data steward', Domain: 'Customer' },
        { parent: 'dom_customer' },
      ),
      e(
        'match_customer',
        'MatchRule',
        540,
        60,
        {
          Name: 'Same company',
          ComparedAttributes: 'Legal name, tax number and postcode',
          MatchType: 'Fuzzy',
          MatchThreshold: 80,
          AutoMergeFrom: 95,
        },
        { parent: 'dom_customer' },
      ),
      e(
        'surv_customer',
        'SurvivorshipRule',
        540,
        180,
        {
          Name: 'Trusted address',
          AppliesTo: 'Billing address and tax number',
          Strategy: 'Most trusted source',
          SourceOrder: 'Order management, then the sales system',
        },
        { parent: 'dom_customer' },
      ),
      // Product
      e(
        'dom_product',
        'MasterDataDomain',
        260,
        440,
        { Name: 'Product', Owner: 'Head of engineering' },
        { w: 520, h: 400 },
      ),
      e(
        'product',
        'DataEntity',
        290,
        510,
        {
          Name: 'Product',
          SourceRecords: 90000,
          GoldenRecords: 41000,
          Fields: fields(
            ['Part number', 'Identifier', true],
            ['Description', 'Text'],
            ['Unit of measure', 'Code'],
            ['Weight', 'Decimal'],
          ),
        },
        { parent: 'dom_product' },
      ),
      e(
        'stw_product',
        'DataSteward',
        560,
        700,
        { Name: 'Product data steward', Domain: 'Product' },
        { parent: 'dom_product' },
      ),
      e(
        'match_product',
        'MatchRule',
        540,
        480,
        {
          Name: 'Same part',
          ComparedAttributes: 'Part number and description',
          MatchType: 'Exact',
          MatchThreshold: 100,
          AutoMergeFrom: 100,
        },
        { parent: 'dom_product' },
      ),
      e(
        'surv_product',
        'SurvivorshipRule',
        540,
        600,
        {
          Name: 'Engineering wins',
          AppliesTo: 'Description, unit and weight',
          Strategy: 'Most trusted source',
          SourceOrder: 'Product design system, then purchasing',
        },
        { parent: 'dom_product' },
      ),
      // Supplier
      e(
        'dom_supplier',
        'MasterDataDomain',
        260,
        880,
        { Name: 'Supplier', Owner: 'Head of purchasing' },
        { w: 520, h: 230 },
      ),
      e(
        'supplier',
        'DataEntity',
        290,
        940,
        {
          Name: 'Supplier',
          SourceRecords: 9100,
          GoldenRecords: 5800,
          Fields: fields(
            ['Supplier number', 'Identifier', true],
            ['Legal name', 'Text'],
            ['Bank account', 'Text'],
          ),
        },
        { parent: 'dom_supplier' },
      ),
      e(
        'match_supplier',
        'MatchRule',
        540,
        910,
        {
          Name: 'Same supplier',
          ComparedAttributes: 'Legal name and tax number',
          MatchType: 'Probabilistic',
          MatchThreshold: 85,
          AutoMergeFrom: 97,
        },
        { parent: 'dom_supplier' },
      ),
      e(
        'surv_supplier',
        'SurvivorshipRule',
        540,
        1030,
        {
          Name: 'Newest bank details',
          AppliesTo: 'Bank account',
          Strategy: 'Most recent',
        },
        { parent: 'dom_supplier' },
      ),
      // Hubs and the systems that use golden records
      e('hub_customer', 'MDMHub', 860, 110, {
        Name: 'Customer hub',
        Style: 'Coexistence',
      }),
      e('hub_product', 'MDMHub', 860, 530, {
        Name: 'Product hub',
        Style: 'Centralised',
      }),
      e('hub_supplier', 'MDMHub', 860, 960, {
        Name: 'Supplier registry',
        Style: 'Registry',
      }),
      e('app_billing', 'Application', 1110, 40, {
        Name: 'Billing',
        Owner: 'Finance',
      }),
      e('app_portal', 'Application', 1110, 190, {
        Name: 'Customer portal',
        Owner: 'Customer service',
      }),
      e('app_catalogue', 'Application', 1110, 460, {
        Name: 'Online catalogue',
        Owner: 'Marketing',
      }),
      e('app_planning', 'Application', 1110, 600, {
        Name: 'Production planning',
        Owner: 'Operations',
      }),
    ],
    connectors: [
      c('Supplies', 'src_crm', 'customer', { Trust: 2 }),
      c('Supplies', 'src_orders', 'customer', { Trust: 1 }),
      c('Supplies', 'src_service', 'customer', { Trust: 3 }),
      c('Supplies', 'src_design', 'product', { Trust: 1 }),
      c('Supplies', 'src_erp', 'product', { Trust: 2 }),
      c('Supplies', 'src_erp', 'supplier', { Trust: 1 }),
      c('Supplies', 'src_portal', 'supplier', { Trust: 2 }),
      c('MatchedBy', 'customer', 'match_customer'),
      c('MergedBy', 'customer', 'surv_customer'),
      c('MatchedBy', 'product', 'match_product'),
      c('MergedBy', 'product', 'surv_product'),
      c('MatchedBy', 'supplier', 'match_supplier'),
      c('MergedBy', 'supplier', 'surv_supplier'),
      c('Stewards', 'stw_customer', 'customer'),
      c('Stewards', 'stw_product', 'product'),
      c('ManagedIn', 'customer', 'hub_customer'),
      c('ManagedIn', 'product', 'hub_product'),
      c('ManagedIn', 'supplier', 'hub_supplier'),
      c('Distributes', 'hub_customer', 'app_billing', { Frequency: 'Live' }),
      c('Distributes', 'hub_customer', 'app_portal', { Frequency: 'Daily' }),
      c('Distributes', 'hub_product', 'app_catalogue', { Frequency: 'Daily' }),
      c('Distributes', 'hub_product', 'app_planning', { Frequency: 'Live' }),
    ],
  },
};
