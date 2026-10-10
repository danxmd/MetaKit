import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
  int,
  line,
  long,
  look,
  text,
  type CatalogAttribute,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Analytics and BI landscape: datasets flow into semantic models, which define metrics and feed
 * reports and dashboards; reports and dashboards show metrics and serve audiences. Usage and
 * refresh are recorded, tools are free text. Checks find content without an owner and metrics
 * defined in more than one semantic model.
 */

const USAGE_FILL = {
  by: 'UsageLevel',
  values: {
    High: '#b2f2bb',
    Medium: '#d3f9d8',
    Low: '#fff3bf',
    Unused: '#dee2e6',
  },
  fallback: '#f8f9fa',
};

const certified = (help: string): CatalogAttribute => ({
  type: 'boolean',
  key: 'Certified',
  label: 'Certified',
  help,
});

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

export const analyticsBi: KitSpec = {
  folder: 'analytics-bi',
  id: 'kit_analyticsbi' as KitId,
  name: 'Analytics and BI landscape',
  catalog: { keys: ['Dataset'] },
  classes: [
    {
      key: 'SemanticModel',
      label: 'Semantic model',
      help: 'A shared, business-friendly layer over the data, with the agreed definitions of metrics, that reports and dashboards are built on.',
      look: look('box', {
        fill: '#e5dbff',
        border: '#6741d9',
        borderWidth: 2,
        icon: 'database',
        subtitle: 'RefreshSchedule',
        width: 180,
        height: 70,
      }),
      attributes: [
        long('Description'),
        text('Owner'),
        text('Tool', { help: 'The BI tool it lives in, as free text.' }),
        choice('StorageMode', ['Import', 'Direct query', 'Mixed'], {
          help: 'Import copies the data into the model; direct query reads it from the source each time.',
        }),
        text('RefreshSchedule', {
          label: 'Refresh',
          help: 'When imported data is refreshed, such as "every day at 06:00".',
        }),
        certified('Yes when the data team has checked it and vouches for it.'),
        formula(
          'Metrics',
          "count(incoming('DefinedIn'))",
          'number',
          'How many metrics are defined in it.',
        ),
        formula(
          'Datasets',
          "count(incoming('FlowsTo'))",
          'number',
          'How many datasets flow into it.',
        ),
        formula(
          'UsedBy',
          "count(outgoing('FlowsTo'))",
          'number',
          'How many reports and dashboards are built on it.',
        ),
      ],
      constraints: [
        {
          id: 'k_semantic_data',
          formula: 'Datasets > 0',
          message:
            "= 'Semantic model \"' + Name + '\" has no dataset flowing into it.'",
        },
      ],
    },
    {
      key: 'Metric',
      label: 'Metric',
      help: 'A measure with one agreed definition, such as net revenue, defined once in a semantic model and shown on reports and dashboards.',
      look: look('pill', {
        fill: '#fff3bf',
        border: '#f08c00',
        subtitle: 'Calculation',
        width: 170,
        height: 50,
      }),
      attributes: [
        long('Definition', {
          help: 'What the number means, in words the business agrees on.',
        }),
        text('Calculation', {
          help: 'How it is calculated, such as "sum of net amount minus returns".',
        }),
        text('Unit'),
        text('Owner'),
        certified('Yes when the owner has approved the definition.'),
        formula(
          'Definitions',
          "count(outgoing('DefinedIn'))",
          'number',
          'In how many semantic models it is defined.',
        ),
        formula(
          'DefinedInText',
          "join(outgoing('DefinedIn').Name, ', ')",
          'text',
          'The semantic models that define it.',
          { label: 'Defined in' },
        ),
        formula(
          'ShownOn',
          "count(incoming('Shows'))",
          'number',
          'How many reports and dashboards show it.',
        ),
      ],
      constraints: [
        {
          id: 'k_metric_twice',
          formula: 'Definitions <= 1',
          message:
            "= 'Metric \"' + Name + '\" is defined in ' + text(Definitions) + ' semantic models (' + DefinedInText + '): keep one definition and reuse it.'",
        },
        {
          id: 'k_metric_defined',
          formula: 'Definitions > 0',
          message:
            "= 'Metric \"' + Name + '\" is defined in no semantic model.'",
        },
      ],
    },
    {
      key: 'Content',
      label: 'Report or dashboard',
      help: 'What people open to read data: a report or a dashboard. Use one of the two.',
      abstract: true,
      attributes: [
        long('Description'),
        text('Owner'),
        text('Tool', { help: 'The BI tool it is built with, as free text.' }),
        choice('Refresh', [
          'Real time',
          'Hourly',
          'Daily',
          'Weekly',
          'Monthly',
        ]),
        int('MonthlyViews', {
          min: 0,
          help: 'How often it was opened last month.',
        }),
        certified('Yes when the data team vouches for it.'),
        formula(
          'UsageLevel',
          "MonthlyViews == null ? null : MonthlyViews == 0 ? 'Unused' : MonthlyViews < 50 ? 'Low' : MonthlyViews < 500 ? 'Medium' : 'High'",
          'text',
          'Unused, Low (under 50 views a month), Medium (under 500) or High. The fill shows it.',
        ),
        formula(
          'Metrics',
          "count(outgoing('Shows'))",
          'number',
          'How many metrics it shows.',
        ),
        formula(
          'Audiences',
          "join(outgoing('Serves').Name, ', ')",
          'text',
          'The audiences it serves.',
        ),
      ],
      constraints: [
        {
          id: 'k_content_owner',
          formula: '!isEmpty(Owner)',
          message:
            "= '\"' + Name + '\" has no owner: name the person or team who answers for it.'",
        },
        {
          id: 'k_content_source',
          formula: "count(incoming('FlowsTo')) > 0",
          message:
            '= \'"\' + Name + \'" is built on no semantic model or dataset: connect one to it with "Flows to".\'',
        },
      ],
    },
    {
      key: 'Report',
      label: 'Report',
      help: 'A report with a fixed layout, often printed or exported, such as a monthly profit and loss report.',
      extends: 'Content',
      look: look('document', {
        fill: USAGE_FILL,
        border: '#1c7ed6',
        subtitle: 'Owner',
        width: 160,
        height: 90,
      }),
      attributes: [
        choice('Format', ['Paginated', 'Spreadsheet', 'Export file']),
      ],
    },
    {
      key: 'Dashboard',
      label: 'Dashboard',
      help: 'An interactive page of charts and figures that people explore.',
      extends: 'Content',
      look: look('header-box', {
        fill: USAGE_FILL,
        border: '#1c7ed6',
        icon: 'star',
        fields: ['Owner', 'MonthlyViews', 'Refresh'],
        width: 190,
      }),
      attributes: [int('Pages', { min: 1 })],
    },
    {
      key: 'Audience',
      label: 'Audience',
      help: 'A group of people who use reports and dashboards, such as store managers.',
      look: look('rounded', {
        fill: '#f3f0ff',
        border: '#7048e8',
        icon: 'person',
        subtitle: 'Department',
        width: 170,
        height: 64,
      }),
      attributes: [
        text('Department'),
        int('People', { min: 0, help: 'About how many people it has.' }),
        long('Needs', { help: 'What they want to know from the data.' }),
        formula(
          'Content',
          "count(incoming('Serves'))",
          'number',
          'How many reports and dashboards serve it.',
        ),
      ],
    },
  ],
  amend: {
    Dataset: {
      help: 'A table or a set of files that semantic models, reports or dashboards read.',
      look: look('header-box', {
        fill: '#a5d8ff',
        border: '#1c7ed6',
        icon: 'database',
        fields: ['Format', 'Refresh'],
        width: 170,
        height: 90,
      }),
    },
  },
  relations: [
    {
      key: 'DefinedIn',
      label: 'Defined in',
      help: 'The semantic model holds the definition of the metric.',
      from: ['Metric'],
      to: ['SemanticModel'],
      look: line('#f08c00', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'Shows',
      label: 'Shows',
      help: 'The report or dashboard shows the metric.',
      from: ['Content'],
      to: ['Metric'],
      look: line('#f08c00', { style: 'dotted' }),
    },
    {
      key: 'Serves',
      label: 'Serves',
      help: 'The report or dashboard is made for the audience.',
      from: ['Content'],
      to: ['Audience'],
      look: line('#7048e8'),
    },
  ],
  amendRelations: {
    FlowsTo: {
      from: ['SemanticModel'],
      to: ['SemanticModel', 'Content'],
    },
  },
  modelTypes: [
    {
      key: 'BILandscape',
      label: 'Analytics and BI landscape',
      help: 'Datasets, semantic models, metrics, reports and dashboards, and the audiences they serve.',
      views: [
        {
          key: 'Models',
          label: 'Data and semantic models',
          classes: ['Dataset', 'SemanticModel', 'Metric'],
          relations: ['FlowsTo', 'DefinedIn'],
        },
        {
          key: 'Content',
          label: 'Content and audiences',
          classes: ['Report', 'Dashboard', 'Audience', 'Metric'],
          relations: ['Shows', 'Serves'],
        },
      ],
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        formula(
          'ContentCount',
          "count(objects('Content'))",
          'number',
          'How many reports and dashboards the model holds.',
          { label: 'Reports and dashboards' },
        ),
        formula(
          'MonthlyViews',
          "sum(objects('Content').MonthlyViews)",
          'number',
          'The views of all reports and dashboards last month.',
        ),
        formula(
          'MetricCount',
          "count(objects('Metric'))",
          'number',
          'How many metrics the model holds.',
          { label: 'Metrics' },
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Dashboard',
      tabs: [
        {
          label: 'Dashboard',
          items: [
            'Name',
            'Owner',
            'Tool',
            'Pages',
            'Certified',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Use',
          items: [
            { attribute: 'Refresh', control: 'select' },
            'MonthlyViews',
            'UsageLevel',
            'Metrics',
            'Audiences',
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Metric',
      tabs: [
        {
          label: 'Metric',
          items: [
            'Name',
            { attribute: 'Definition', control: 'textarea' },
            'Calculation',
            'Unit',
            'Owner',
            'Certified',
          ],
        },
        {
          label: 'Use',
          items: ['DefinedInText', 'Definitions', 'ShownOn'],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'retail-analytics.mkmodel.json',
    id: 'mdl_retailanalytics',
    name: 'Sales and finance analytics',
    modelType: 'BILandscape',
    attributes: {
      Title: 'Sales and finance analytics',
      Organisation: 'A chain of hardware stores',
    },
    // "Store performance" has no owner and "Net revenue" is defined twice, on purpose.
    intendedWarnings: 2,
    elements: [
      e('ds_sales', 'Dataset', 40, 40, {
        Name: 'Sales',
        Refresh: 'Daily',
        Format: 'Table',
      }),
      e('ds_stores', 'Dataset', 40, 190, {
        Name: 'Stores',
        Refresh: 'Weekly',
        Format: 'Table',
      }),
      e('ds_footfall', 'Dataset', 40, 340, {
        Name: 'Footfall counts',
        Refresh: 'Hourly',
        Format: 'Files',
      }),
      e('ds_budget', 'Dataset', 40, 490, {
        Name: 'Budget',
        Refresh: 'Monthly',
        Format: 'Spreadsheet',
      }),
      e('sm_sales', 'SemanticModel', 300, 150, {
        Name: 'Sales model',
        Owner: 'Sales analytics team',
        StorageMode: 'Import',
        RefreshSchedule: 'Daily at 06:00',
        Certified: true,
      }),
      e('sm_finance', 'SemanticModel', 300, 450, {
        Name: 'Finance model',
        Owner: 'Finance controlling',
        StorageMode: 'Import',
        RefreshSchedule: 'Monthly',
      }),
      e('db_exec', 'Dashboard', 840, 40, {
        Name: 'Executive sales',
        Owner: 'Head of sales analytics',
        Tool: 'Company BI tool',
        Refresh: 'Daily',
        MonthlyViews: 820,
        Certified: true,
      }),
      e('db_stores', 'Dashboard', 840, 190, {
        Name: 'Store performance',
        Tool: 'Company BI tool',
        Refresh: 'Daily',
        MonthlyViews: 1450,
      }),
      e('rp_regional', 'Report', 855, 340, {
        Name: 'Regional sales report',
        Owner: 'Sales analytics team',
        Format: 'Paginated',
        Refresh: 'Weekly',
        MonthlyViews: 0,
      }),
      e('rp_pnl', 'Report', 855, 470, {
        Name: 'Monthly profit and loss',
        Owner: 'Finance controlling',
        Format: 'Spreadsheet',
        Refresh: 'Monthly',
        MonthlyViews: 120,
      }),
      e('aud_exec', 'Audience', 1120, 60, {
        Name: 'Executive team',
        Department: 'Management',
        People: 12,
      }),
      e('aud_stores', 'Audience', 1120, 240, {
        Name: 'Store managers',
        Department: 'Retail operations',
        People: 140,
      }),
      e('aud_finance', 'Audience', 1120, 490, {
        Name: 'Finance team',
        Department: 'Finance',
        People: 25,
      }),
      e('m_revenue', 'Metric', 560, 300, {
        Name: 'Net revenue',
        Calculation: 'Sales minus returns and discounts',
        Unit: 'currency',
        Owner: 'Head of finance',
        Certified: true,
      }),
      e('m_margin', 'Metric', 560, 460, {
        Name: 'Gross margin',
        Calculation: 'Net revenue minus cost of goods',
        Unit: '%',
        Owner: 'Head of finance',
      }),
      e('m_basket', 'Metric', 560, 60, {
        Name: 'Basket size',
        Calculation: 'Net revenue per receipt',
        Unit: 'currency',
        Owner: 'Head of sales',
      }),
      e('m_conversion', 'Metric', 560, 140, {
        Name: 'Footfall conversion',
        Calculation: 'Receipts per hundred visitors',
        Unit: '%',
        Owner: 'Head of sales',
      }),
      e('m_variance', 'Metric', 560, 540, {
        Name: 'Budget variance',
        Calculation: 'Net revenue minus budget',
        Unit: 'currency',
        Owner: 'Head of finance',
      }),
    ],
    connectors: [
      c('FlowsTo', 'ds_sales', 'sm_sales', { Frequency: 'Daily' }),
      c('FlowsTo', 'ds_stores', 'sm_sales'),
      c('FlowsTo', 'ds_footfall', 'sm_sales', { Frequency: 'Hourly' }),
      c('FlowsTo', 'ds_sales', 'sm_finance', { Frequency: 'Monthly' }),
      c('FlowsTo', 'ds_budget', 'sm_finance'),
      c('FlowsTo', 'sm_sales', 'db_exec'),
      c('FlowsTo', 'sm_sales', 'db_stores'),
      c('FlowsTo', 'sm_sales', 'rp_regional'),
      c('FlowsTo', 'sm_finance', 'rp_pnl'),
      c('DefinedIn', 'm_revenue', 'sm_sales'),
      c('DefinedIn', 'm_revenue', 'sm_finance'),
      c('DefinedIn', 'm_basket', 'sm_sales'),
      c('DefinedIn', 'm_conversion', 'sm_sales'),
      c('DefinedIn', 'm_margin', 'sm_finance'),
      c('DefinedIn', 'm_variance', 'sm_finance'),
      c('Shows', 'db_exec', 'm_revenue'),
      c('Shows', 'db_exec', 'm_margin'),
      c('Shows', 'db_stores', 'm_basket'),
      c('Shows', 'db_stores', 'm_conversion'),
      c('Shows', 'rp_regional', 'm_revenue'),
      c('Shows', 'rp_pnl', 'm_variance'),
      c('Serves', 'db_exec', 'aud_exec'),
      c('Serves', 'db_stores', 'aud_stores'),
      c('Serves', 'rp_regional', 'aud_stores'),
      c('Serves', 'rp_pnl', 'aud_finance'),
      c('Serves', 'rp_pnl', 'aud_exec'),
    ],
  },
};
