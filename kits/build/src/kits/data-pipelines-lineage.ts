import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
  line,
  long,
  look,
  num,
  text,
  type CatalogAttribute,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Data pipelines and lineage: source systems feed jobs, jobs read and write datasets, and
 * datasets feed reports and target applications. Schedules start jobs, and a job can run after
 * another one. Fields of datasets and reports can be mapped to each other for lineage down to the
 * field. Each step counts its direct upstream and downstream neighbours and how far it is from
 * the sources.
 */

const RUN_FILL = {
  by: 'LastRunStatus',
  values: {
    Succeeded: '#d3f9d8',
    Failed: '#ffc9c9',
    Running: '#fff3bf',
    'Not run yet': '#e9ecef',
  },
  fallback: '#e9ecef',
};

const LAYER_FILL = {
  by: 'Layer',
  values: {
    Raw: '#e9ecef',
    Cleaned: '#d0ebff',
    Curated: '#a5d8ff',
    Serving: '#74c0fc',
  },
  fallback: '#a5d8ff',
};

/** How far from the sources, counted through "Flows to". A source system counts as 0. */
const steps = (): CatalogAttribute =>
  formula(
    'StepsFromSource',
    "count(incoming('FlowsTo')) == 0 ? null : (max(incoming('FlowsTo').StepsFromSource) ?? 0) + 1",
    'number',
    'How many "Flows to" steps lie between it and the furthest source system before it. Empty when nothing flows into it.',
  );
const upstream = (): CatalogAttribute =>
  formula(
    'Upstream',
    "count(incoming('FlowsTo'))",
    'number',
    'How many sources, jobs or datasets feed it directly.',
  );
const downstream = (): CatalogAttribute =>
  formula(
    'Downstream',
    "count(outgoing('FlowsTo'))",
    'number',
    'How many jobs, datasets, reports or applications it feeds directly.',
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

export const dataPipelinesLineage: KitSpec = {
  folder: 'data-pipelines-lineage',
  id: 'kit_datalineage' as KitId,
  name: 'Data pipelines and lineage',
  catalog: {
    keys: ['SourceSystem', 'Dataset', 'ReportOrDashboard', 'Application'],
  },
  classes: [
    {
      key: 'Job',
      label: 'Job',
      help: 'A step that moves or transforms data: it reads what flows into it and writes what flows out of it. The fill shows how its last run went.',
      look: look('rounded', {
        fill: RUN_FILL,
        border: '#1c7ed6',
        icon: 'gear',
        subtitle: 'ScheduleText',
        width: 160,
        height: 60,
      }),
      attributes: [
        long('Description'),
        choice('Kind', [
          'Ingestion',
          'Transformation',
          'Export',
          'Quality check',
        ]),
        text('Tool', {
          help: 'The tool or language it runs in, as free text.',
        }),
        text('Owner'),
        long('Logic', {
          help: 'What it does to the data, in a few lines or as code.',
        }),
        choice('LastRunStatus', [
          'Succeeded',
          'Failed',
          'Running',
          'Not run yet',
        ]),
        num('AverageMinutes', {
          label: 'Average run time',
          unit: 'min',
          min: 0,
        }),
        formula(
          'ScheduleText',
          "count(incoming('Triggers')) > 0 ? join(incoming('Triggers').Name, ', ') : (count(outgoing('RunsAfter')) > 0 ? 'After ' + join(outgoing('RunsAfter').Name, ', ') : null)",
          'text',
          'The schedules that start it, or the jobs it runs after.',
          { label: 'Runs' },
        ),
        upstream(),
        downstream(),
        steps(),
      ],
      constraints: [
        {
          id: 'k_job_schedule',
          formula:
            "count(incoming('Triggers')) > 0 || count(outgoing('RunsAfter')) > 0",
          message:
            '= \'Job "\' + Name + \'" has no schedule: connect a schedule with "Triggers", or the job it runs after with "Runs after".\'',
        },
        {
          id: 'k_job_flows',
          formula: 'Upstream > 0 && Downstream > 0',
          message:
            "= 'Job \"' + Name + '\" needs something that flows into it and something it flows to.'",
        },
      ],
    },
    {
      key: 'Schedule',
      label: 'Schedule',
      help: 'When jobs start: at fixed times, on an event or by hand, and in which orchestration tool (free text).',
      look: look('pill', {
        fill: '#fff3bf',
        border: '#f08c00',
        icon: 'clock',
        subtitle: 'Frequency',
        width: 170,
        height: 50,
      }),
      attributes: [
        long('Description'),
        choice('Frequency', [
          'Every 15 minutes',
          'Hourly',
          'Daily',
          'Weekly',
          'Monthly',
          'On an event',
          'By hand',
        ]),
        text('Cron', {
          label: 'Cron expression',
          help: 'The exact times in cron form, such as "0 2 * * *" for 02:00 every day.',
        }),
        text('Timezone'),
        text('Orchestrator', {
          help: 'The tool that starts the jobs, as free text.',
        }),
        formula(
          'Jobs',
          "count(outgoing('Triggers'))",
          'number',
          'How many jobs it starts.',
        ),
      ],
    },
    {
      key: 'Field',
      label: 'Field',
      help: 'One column of a dataset or one value on a report. Map fields to each other for lineage down to the field.',
      look: look('pill', {
        fill: '#f3f0ff',
        border: '#7048e8',
        subtitle: 'In',
        width: 160,
        height: 44,
      }),
      attributes: [
        text('DataType'),
        long('Description'),
        formula(
          'In',
          "join(outgoing('PartOf').Name, ', ')",
          'text',
          'The dataset or report it belongs to.',
        ),
        formula(
          'SourceFields',
          "count(incoming('MapsTo'))",
          'number',
          'How many fields it is made from.',
        ),
        formula(
          'TargetFields',
          "count(outgoing('MapsTo'))",
          'number',
          'How many fields are made from it.',
        ),
      ],
      constraints: [
        {
          id: 'k_field_partof',
          formula: "count(outgoing('PartOf')) > 0",
          message:
            '= \'Field "\' + Name + \'" belongs to no dataset or report: connect it with "Part of".\'',
        },
      ],
    },
  ],
  amend: {
    Dataset: {
      help: 'A table or a set of files that jobs write and read. Orphan datasets, which nothing feeds and nothing reads, are reported.',
      attributes: [
        choice('Layer', ['Raw', 'Cleaned', 'Curated', 'Serving'], {
          help: 'How far the data has been prepared. The header colour shows it.',
        }),
        text('Location', {
          help: 'Where it is kept, such as a schema and table name.',
        }),
        text('Owner'),
        upstream(),
        downstream(),
        steps(),
      ],
      look: look('header-box', {
        fill: LAYER_FILL,
        border: '#1c7ed6',
        icon: 'database',
        fields: ['Layer', 'Refresh', 'Upstream', 'Downstream'],
      }),
      constraints: [
        {
          id: 'k_dataset_orphan',
          formula: 'Upstream + Downstream > 0',
          message:
            "= 'Dataset \"' + Name + '\" is an orphan: nothing flows into it and it flows nowhere.'",
        },
      ],
    },
    ReportOrDashboard: {
      attributes: [text('Owner'), upstream(), steps()],
      constraints: [
        {
          id: 'k_report_source',
          formula: 'Upstream > 0',
          message: "= 'Report \"' + Name + '\" has no data flowing into it.'",
        },
      ],
    },
    Application: {
      help: 'An operational application that receives data from a pipeline, such as a finance system. A target of the lineage.',
      attributes: [upstream(), steps()],
    },
  },
  relations: [
    {
      key: 'Triggers',
      label: 'Triggers',
      help: 'The schedule starts the job.',
      from: ['Schedule'],
      to: ['Job'],
      look: line('#f08c00', { style: 'dotted' }),
    },
    {
      key: 'RunsAfter',
      label: 'Runs after',
      help: 'The job starts when the other job has finished.',
      from: ['Job'],
      to: ['Job'],
      look: line('#f08c00', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'PartOf',
      label: 'Part of',
      help: 'The field is a column of the dataset or a value on the report.',
      from: ['Field'],
      to: ['Dataset', 'ReportOrDashboard'],
      look: line('#7048e8', { start: 'circle', end: 'none' }),
    },
    {
      key: 'MapsTo',
      label: 'Maps to',
      help: 'The value of the target field is made from this field: lineage at the level of fields.',
      from: ['Field'],
      to: ['Field'],
      attributes: [
        text('Transformation', {
          help: 'How the value is made, such as "amount_cents / 100".',
        }),
      ],
      look: line('#7048e8', { label: 'Transformation' }),
    },
  ],
  amendRelations: {
    FlowsTo: { from: ['Job'], to: ['Job', 'Application'] },
  },
  modelTypes: [
    {
      key: 'Lineage',
      label: 'Data pipelines and lineage',
      help: 'Source systems, jobs, schedules, datasets, reports and target applications, with lineage from field to report.',
      views: [
        {
          key: 'Pipelines',
          label: 'Pipelines',
          classes: [
            'SourceSystem',
            'Job',
            'Schedule',
            'Dataset',
            'ReportOrDashboard',
            'Application',
          ],
          relations: ['FlowsTo', 'Triggers', 'RunsAfter'],
        },
        {
          key: 'FieldLineage',
          label: 'Field lineage',
          classes: ['Dataset', 'ReportOrDashboard', 'Field'],
          relations: ['PartOf', 'MapsTo'],
        },
      ],
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        formula(
          'JobCount',
          "count(objects('Job'))",
          'number',
          'How many jobs the model holds.',
          { label: 'Jobs' },
        ),
        formula(
          'DatasetCount',
          "count(objects('Dataset'))",
          'number',
          'How many datasets the model holds.',
          { label: 'Datasets' },
        ),
        formula(
          'LongestChain',
          "max(objects('ReportOrDashboard').StepsFromSource, objects('Application').StepsFromSource)",
          'number',
          'The most steps between a source system and a report or application.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Job',
      tabs: [
        {
          label: 'Job',
          items: [
            'Name',
            { attribute: 'Kind', control: 'select' },
            'Owner',
            'Tool',
            'ScheduleText',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Runs',
          items: [
            { attribute: 'LastRunStatus', control: 'segmented' },
            'AverageMinutes',
            { attribute: 'Logic', control: 'textarea' },
          ],
        },
        {
          label: 'Lineage',
          items: ['Upstream', 'Downstream', 'StepsFromSource'],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'retail-sales-lineage.mkmodel.json',
    id: 'mdl_retailsaleslineage',
    name: 'Sales reporting pipelines',
    modelType: 'Lineage',
    attributes: {
      Title: 'Sales reporting pipelines',
      Organisation: 'A supermarket chain',
    },
    // "Export to finance" has no schedule and "Old promotions" is an orphan, on purpose.
    intendedWarnings: 2,
    elements: [
      e('src_pos', 'SourceSystem', 40, 170, {
        Name: 'Till system',
        Hosting: 'On-premises',
      }),
      e('src_web', 'SourceSystem', 40, 388, {
        Name: 'Online shop',
        Hosting: 'Software as a service',
      }),
      e('sch_nightly', 'Schedule', 440, 30, {
        Name: 'Nightly at 02:00',
        Frequency: 'Daily',
        Cron: '0 2 * * *',
        Timezone: 'Local time',
      }),
      e('sch_quarter', 'Schedule', 225, 520, {
        Name: 'Every 15 minutes',
        Frequency: 'Every 15 minutes',
        Cron: '*/15 * * * *',
      }),
      e('job_loadpos', 'Job', 230, 175, {
        Name: 'Load till sales',
        Kind: 'Ingestion',
        LastRunStatus: 'Succeeded',
        AverageMinutes: 12,
      }),
      e('job_loadweb', 'Job', 230, 393, {
        Name: 'Load web orders',
        Kind: 'Ingestion',
        LastRunStatus: 'Succeeded',
        AverageMinutes: 2,
      }),
      e('ds_rawpos', 'Dataset', 440, 142, {
        Name: 'raw_till_sales',
        Layer: 'Raw',
        Refresh: 'Daily',
        Location: 'raw.till_sales',
      }),
      e('ds_rawweb', 'Dataset', 440, 360, {
        Name: 'raw_web_orders',
        Layer: 'Raw',
        Refresh: 'Real time',
        Location: 'raw.web_orders',
      }),
      e('job_sales', 'Job', 660, 255, {
        Name: 'Build sales',
        Kind: 'Transformation',
        Owner: 'Sales data team',
        LastRunStatus: 'Succeeded',
        AverageMinutes: 25,
        Logic:
          'Combine till sales and web orders, convert to net amounts and remove test orders.',
      }),
      e('ds_sales', 'Dataset', 870, 222, {
        Name: 'sales',
        Layer: 'Curated',
        Refresh: 'Daily',
        Location: 'curated.sales',
        Classification: 'Internal',
      }),
      e('job_revenue', 'Job', 1090, 60, {
        Name: 'Build daily revenue',
        Kind: 'Transformation',
        Owner: 'Sales data team',
        LastRunStatus: 'Failed',
        AverageMinutes: 8,
      }),
      e('ds_revenue', 'Dataset', 1300, 142, {
        Name: 'daily_revenue',
        Layer: 'Serving',
        Refresh: 'Daily',
        Location: 'serving.daily_revenue',
      }),
      e('job_export', 'Job', 1090, 480, {
        Name: 'Export to finance',
        Kind: 'Export',
        LastRunStatus: 'Not run yet',
      }),
      e('app_finance', 'Application', 1300, 480, {
        Name: 'Finance system',
        Owner: 'Finance',
      }),
      e(
        'rep_dashboard',
        'ReportOrDashboard',
        1520,
        150,
        {
          Name: 'Daily sales dashboard',
          Audience: 'Store managers',
          Refresh: 'Daily',
        },
        { w: 150 },
      ),
      e(
        'rep_stores',
        'ReportOrDashboard',
        1520,
        380,
        {
          Name: 'Store performance report',
          Audience: 'Regional managers',
          Refresh: 'Weekly',
        },
        { w: 150 },
      ),
      e('ds_promotions', 'Dataset', 40, 600, {
        Name: 'old_promotions',
        Layer: 'Raw',
        Location: 'raw.promotions_2019',
      }),
      e('f_amount', 'Field', 445, 280, {
        Name: 'amount_cents',
        DataType: 'integer',
      }),
      e('f_total', 'Field', 445, 500, {
        Name: 'order_total',
        DataType: 'decimal',
      }),
      e('f_net', 'Field', 875, 370, {
        Name: 'net_amount',
        DataType: 'decimal',
      }),
      e('f_revenue', 'Field', 1305, 290, {
        Name: 'revenue',
        DataType: 'decimal',
      }),
      e('f_dashrevenue', 'Field', 1515, 260, {
        Name: 'Revenue today',
      }),
    ],
    connectors: [
      c('FlowsTo', 'src_pos', 'job_loadpos'),
      c('FlowsTo', 'job_loadpos', 'ds_rawpos'),
      c('FlowsTo', 'src_web', 'job_loadweb'),
      c('FlowsTo', 'job_loadweb', 'ds_rawweb'),
      c('FlowsTo', 'ds_rawpos', 'job_sales'),
      c('FlowsTo', 'ds_rawweb', 'job_sales'),
      c('FlowsTo', 'job_sales', 'ds_sales'),
      c('FlowsTo', 'ds_sales', 'job_revenue'),
      c('FlowsTo', 'job_revenue', 'ds_revenue'),
      c('FlowsTo', 'ds_revenue', 'rep_dashboard', { Frequency: 'Daily' }),
      c('FlowsTo', 'ds_revenue', 'rep_stores', { Frequency: 'Weekly' }),
      c('FlowsTo', 'ds_sales', 'job_export'),
      c('FlowsTo', 'job_export', 'app_finance'),
      c('Triggers', 'sch_nightly', 'job_loadpos'),
      c('Triggers', 'sch_nightly', 'job_sales'),
      c('Triggers', 'sch_quarter', 'job_loadweb'),
      c('RunsAfter', 'job_revenue', 'job_sales'),
      c('PartOf', 'f_amount', 'ds_rawpos'),
      c('PartOf', 'f_total', 'ds_rawweb'),
      c('PartOf', 'f_net', 'ds_sales'),
      c('PartOf', 'f_revenue', 'ds_revenue'),
      c('PartOf', 'f_dashrevenue', 'rep_dashboard'),
      c('MapsTo', 'f_amount', 'f_net', {
        Transformation: 'amount_cents / 100 minus discounts',
      }),
      c('MapsTo', 'f_total', 'f_net', {
        Transformation: 'order_total minus tax',
      }),
      c('MapsTo', 'f_net', 'f_revenue', {
        Transformation: 'sum per store and day',
      }),
      c('MapsTo', 'f_revenue', 'f_dashrevenue'),
    ],
  },
};
