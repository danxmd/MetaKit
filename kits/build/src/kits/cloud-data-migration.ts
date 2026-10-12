import type { KitId, NodeLook } from '@metakit-app/core';
import {
  choice,
  date,
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
 * Cloud data migration: workloads move from source systems to target services in a cloud
 * platform, in migration waves. Each wave shows how ready its workloads are and has a cut-over
 * plan; dependencies between workloads, risks and the status of each workload are recorded. A
 * check finds workloads planned in an earlier wave than a workload they depend on.
 */

/** Containers are see-through, so the lines between the objects inside them show. */
const CLEAR = '#ffffff00';

const STATUSES = [
  'Not started',
  'Assessed',
  'Ready',
  'Migrating',
  'Migrated',
  'Validated',
];

const STATUS_FILL = {
  by: 'Status',
  values: {
    'Not started': '#e9ecef',
    Assessed: '#fff3bf',
    Ready: '#d0ebff',
    Migrating: '#a5d8ff',
    Migrated: '#d3f9d8',
    Validated: '#b2f2bb',
  },
  fallback: '#e9ecef',
};

const WAVE_LOOK: NodeLook = {
  ...look('container', {
    fill: CLEAR,
    border: {
      by: 'ReadinessLevel',
      values: {
        Ready: '#2f9e44',
        'Nearly ready': '#f08c00',
        'Not ready': '#e03131',
      },
      fallback: '#495057',
    },
    title: 'Summary',
    width: 400,
    height: 300,
  }),
  borderWidth: 2,
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

/** A workload inside a wave, one of up to three under each other. */
const workload = (
  id: string,
  wave: string,
  waveX: number,
  row: number,
  values: Record<string, string | number>,
) => e(id, 'Workload', waveX + 20, 230 + row * 80, values, { parent: wave });

export const cloudDataMigration: KitSpec = {
  folder: 'cloud-data-migration',
  id: 'kit_clouddatamigration' as KitId,
  name: 'Cloud data migration',
  catalog: { keys: ['SourceSystem', 'CloudPlatform', 'Risk'] },
  classes: [
    {
      key: 'MigrationWave',
      label: 'Migration wave',
      help: 'A group of workloads that move together, in a fixed order. Place its workloads and its cut-over plan inside it. The border shows how ready the wave is.',
      kind: 'container',
      look: WAVE_LOOK,
      attributes: [
        long('Description'),
        int('Sequence', {
          min: 1,
          help: 'The order of the wave: 1 moves first.',
        }),
        date('Start'),
        date('End', { label: 'Cut-over date' }),
        formula(
          'Workloads',
          'count(children().Readiness)',
          'number',
          'How many workloads it holds.',
        ),
        formula(
          'SizeGB',
          'sum(children().SizeGB)',
          'number',
          'The size of its workloads together, in gigabytes.',
          { label: 'Size (GB)' },
        ),
        formula(
          'Readiness',
          'IFERROR(round(avg(children().Readiness), 0), null)',
          'number',
          'The average readiness of its workloads, in percent.',
          { label: 'Readiness (%)' },
        ),
        formula(
          'Progress',
          'IFERROR(round(avg(children().Progress), 0), null)',
          'number',
          'The average progress of its workloads, in percent.',
          { label: 'Progress (%)' },
        ),
        formula(
          'ReadinessLevel',
          "Readiness == null ? null : Readiness == 100 ? 'Ready' : Readiness >= 75 ? 'Nearly ready' : 'Not ready'",
          'text',
          'Ready when every workload is ready, Nearly ready from 75%, otherwise Not ready. The border shows it.',
        ),
        formula(
          'Summary',
          "Name + (Readiness == null ? '' : ' (' + text(Readiness) + '% ready)')",
          'text',
          'The name and the readiness, shown as the heading.',
        ),
      ],
      constraints: [
        {
          id: 'k_wave_dates',
          formula: 'Start == null || End == null || Start <= End',
          message: "= 'Wave \"' + Name + '\" ends before it starts.'",
        },
      ],
    },
    {
      key: 'Workload',
      label: 'Workload',
      help: 'Something that moves to the cloud: a database, a warehouse, files, loading jobs or reports. The fill shows its status.',
      look: look('rounded', {
        fill: STATUS_FILL,
        border: '#1c7ed6',
        subtitle: 'StatusText',
        width: 200,
        height: 60,
      }),
      attributes: [
        long('Description'),
        choice(
          'WorkloadType',
          [
            'Database',
            'Data warehouse',
            'Files',
            'Loading jobs',
            'Reports',
            'Application data',
          ],
          { label: 'Type' },
        ),
        num('SizeGB', { label: 'Size (GB)', min: 0 }),
        choice(
          'Approach',
          ['Rehost', 'Replatform', 'Refactor', 'Retire', 'Retain'],
          {
            help: 'Rehost moves it as it is, replatform changes the platform a little, refactor rebuilds it, retire switches it off and retain keeps it where it is.',
          },
        ),
        choice('Complexity', ['Low', 'Medium', 'High']),
        choice('Status', STATUSES, { default: 'Not started' }),
        text('Owner'),
        formula(
          'Wave',
          'parent ? parent.Name : null',
          'text',
          'The wave it is planned in.',
        ),
        formula(
          'WaveNumber',
          'parent ? parent.Sequence : null',
          'number',
          'The sequence of its wave.',
        ),
        formula(
          'LatestDependency',
          "max(outgoing('DependsOn').WaveNumber)",
          'number',
          'The latest wave among the workloads it depends on.',
          { label: 'Latest wave it depends on' },
        ),
        formula(
          'Readiness',
          "Status == 'Not started' || Status == null ? 0 : Status == 'Assessed' ? 50 : 100",
          'number',
          'Not started 0%, assessed 50%, ready or later 100%.',
          { label: 'Readiness (%)' },
        ),
        formula(
          'Progress',
          "Status == 'Validated' ? 100 : Status == 'Migrated' ? 80 : Status == 'Migrating' ? 60 : Status == 'Ready' ? 40 : Status == 'Assessed' ? 20 : 0",
          'number',
          'From 0% (not started) to 100% (validated after the move).',
          { label: 'Progress (%)' },
        ),
        formula(
          'StatusText',
          "(Status ?? 'Not started') + (Approach ? ' · ' + Approach : '')",
          'text',
          'The status and the approach, shown under the name.',
        ),
      ],
      constraints: [
        {
          id: 'k_workload_order',
          formula:
            'WaveNumber == null || LatestDependency == null || LatestDependency <= WaveNumber',
          message:
            "= 'Workload \"' + Name + '\" moves in wave ' + text(WaveNumber) + ' but depends on a workload of wave ' + text(LatestDependency) + '.'",
        },
        {
          id: 'k_workload_wave',
          formula: 'parent != null',
          message:
            "= 'Workload \"' + Name + '\" is not planned in a wave: place it inside one.'",
        },
        {
          id: 'k_workload_target',
          formula:
            "Approach == 'Retire' || Approach == 'Retain' || count(outgoing('MovesTo')) > 0",
          message:
            '= \'Workload "\' + Name + \'" has no target: connect the service it moves to with "Moves to".\'',
        },
      ],
    },
    {
      key: 'TargetService',
      label: 'Target service',
      help: 'A cloud service that receives workloads, such as object storage or a managed database. Technology is free text.',
      look: look('box', {
        fill: '#c3fae8',
        border: '#0c8599',
        icon: 'cloud',
        subtitle: 'ServiceType',
        width: 180,
        height: 70,
      }),
      attributes: [
        long('Description'),
        choice(
          'ServiceType',
          [
            'Object storage',
            'Managed database',
            'Data warehouse',
            'Lakehouse',
            'Integration service',
            'Analytics service',
          ],
          { label: 'Type' },
        ),
        text('Technology'),
        text('Region'),
        formula(
          'Workloads',
          "count(incoming('MovesTo'))",
          'number',
          'How many workloads move to it.',
        ),
        formula(
          'IncomingGB',
          "sum(incoming('MovesTo').SizeGB)",
          'number',
          'The size of the workloads that move to it, in gigabytes.',
          { label: 'Incoming (GB)' },
        ),
      ],
    },
    {
      key: 'CutoverPlan',
      label: 'Cut-over plan',
      help: 'How a wave switches over: the window, the go or no-go decision and how to go back if it fails. Place it inside its wave.',
      look: look('document', {
        fill: {
          by: 'Decision',
          values: { Go: '#b2f2bb', 'No go': '#ffc9c9' },
          fallback: '#fff9db',
        },
        border: '#f08c00',
        icon: 'flag',
        subtitle: 'Window',
        width: 140,
        height: 90,
      }),
      attributes: [
        text('Window', {
          help: 'When the switch happens, such as "Saturday 22:00 to Sunday 06:00".',
        }),
        text('Owner'),
        choice('Decision', ['Not decided', 'Go', 'No go'], {
          label: 'Go or no go',
          default: 'Not decided',
        }),
        long('Steps'),
        long('RollbackPlan', {
          help: 'How to switch back to the old systems if the cut-over fails.',
        }),
        formula(
          'Wave',
          'parent ? parent.Name : null',
          'text',
          'The wave it belongs to.',
        ),
      ],
      constraints: [
        {
          id: 'k_cutover_rollback',
          formula: '!isEmpty(RollbackPlan)',
          message: "= 'Cut-over plan \"' + Name + '\" has no rollback plan.'",
        },
      ],
    },
  ],
  amend: {
    SourceSystem: {
      help: 'A system or database where the data lives today.',
      attributes: [
        date('Decommission', {
          label: 'Switch off',
          help: 'When it can be switched off after the move.',
        }),
        formula(
          'Workloads',
          "count(incoming('MovesFrom'))",
          'number',
          'How many workloads move away from it.',
        ),
      ],
    },
    CloudPlatform: {
      help: 'The cloud account or region the data moves to. Place the target services inside it. The provider is free text.',
      look: look('container', {
        fill: CLEAR,
        border: '#0c8599',
        icon: 'cloud',
        width: 1240,
        height: 150,
      }),
    },
  },
  relations: [
    {
      key: 'MovesFrom',
      label: 'Moves from',
      help: 'The workload leaves this source system.',
      from: ['Workload'],
      to: ['SourceSystem'],
      look: line('#868e96', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'MovesTo',
      label: 'Moves to',
      help: 'The workload lands in this target service.',
      from: ['Workload'],
      to: ['TargetService'],
      look: line('#0c8599'),
    },
    {
      key: 'DependsOn',
      label: 'Depends on',
      help: 'The workload needs the other one to move first, or in the same wave.',
      from: ['Workload'],
      to: ['Workload'],
      look: line('#e03131', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'HasRisk',
      label: 'Has risk',
      help: 'The workload or the wave is exposed to the risk.',
      from: ['Workload', 'MigrationWave'],
      to: ['Risk'],
      look: line('#e03131', { style: 'dotted' }),
    },
  ],
  modelTypes: [
    {
      key: 'Migration',
      label: 'Cloud data migration',
      help: 'Source systems, workloads planned in migration waves with cut-over plans, target services in a cloud platform, dependencies and risks.',
      views: [
        {
          key: 'Plan',
          label: 'Waves and dependencies',
          classes: ['MigrationWave', 'Workload', 'CutoverPlan', 'Risk'],
          relations: ['DependsOn', 'HasRisk'],
        },
        {
          key: 'Systems',
          label: 'From and to',
          classes: [
            'SourceSystem',
            'Workload',
            'CloudPlatform',
            'TargetService',
          ],
          relations: ['MovesFrom', 'MovesTo'],
        },
      ],
      containers: {
        MigrationWave: ['Workload', 'CutoverPlan'],
        CloudPlatform: ['TargetService'],
      },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        formula(
          'TotalGB',
          "sum(objects('Workload').SizeGB)",
          'number',
          'The size of all workloads, in gigabytes.',
          { label: 'Total size (GB)' },
        ),
        formula(
          'OverallProgress',
          "IFERROR(round(avg(objects('Workload').Progress), 0), null)",
          'number',
          'The average progress of all workloads, in percent.',
          { label: 'Overall progress (%)' },
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Workload',
      tabs: [
        {
          label: 'Workload',
          items: [
            'Name',
            { attribute: 'WorkloadType', control: 'select' },
            'SizeGB',
            { attribute: 'Approach', control: 'select' },
            { attribute: 'Complexity', control: 'segmented' },
            'Owner',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Status',
          items: [
            { attribute: 'Status', control: 'select' },
            'Readiness',
            'Progress',
            'Wave',
            'WaveNumber',
            'LatestDependency',
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'MigrationWave',
      tabs: [
        {
          label: 'Wave',
          items: [
            'Name',
            'Sequence',
            'Start',
            'End',
            { attribute: 'Description', control: 'textarea' },
          ],
        },
        {
          label: 'Readiness',
          items: [
            'Workloads',
            'SizeGB',
            'Readiness',
            'ReadinessLevel',
            'Progress',
          ],
        },
      ],
    },
  ],
  sample: {
    file: 'bank-migration.mkmodel.json',
    id: 'mdl_bankmigration',
    name: 'Data platform migration',
    modelType: 'Migration',
    attributes: {
      Title: 'Data platform migration',
      Organisation: 'A regional bank',
    },
    // "Regulatory reports" moves in wave 2 but depends on the risk data mart of wave 3, on purpose.
    intendedWarnings: 1,
    elements: [
      e('src_core', 'SourceSystem', 1020, 40, {
        Name: 'Core banking database',
        Technology: 'Relational database',
        Hosting: 'On-premises',
      }),
      e('src_dwh', 'SourceSystem', 420, 40, {
        Name: 'Customer data warehouse',
        Technology: 'Data warehouse appliance',
        Hosting: 'On-premises',
        Decommission: '2028-06-30',
      }),
      e('src_risk', 'SourceSystem', 720, 40, {
        Name: 'Risk data mart',
        Technology: 'Relational database',
        Hosting: 'On-premises',
      }),
      e('src_files', 'SourceSystem', 120, 40, {
        Name: 'Reporting file share',
        Technology: 'File server',
        Hosting: 'On-premises',
        Decommission: '2027-12-31',
      }),
      // Wave 1
      e(
        'wave1',
        'MigrationWave',
        40,
        170,
        {
          Name: 'Wave 1: Foundations',
          Sequence: 1,
          Start: '2027-09-01',
          End: '2027-11-13',
        },
        { w: 400, h: 300 },
      ),
      workload('wl_files', 'wave1', 40, 0, {
        Name: 'Report archive',
        WorkloadType: 'Files',
        SizeGB: 4200,
        Approach: 'Rehost',
        Complexity: 'Low',
        Status: 'Validated',
      }),
      workload('wl_reference', 'wave1', 40, 1, {
        Name: 'Reference data',
        WorkloadType: 'Database',
        SizeGB: 60,
        Approach: 'Replatform',
        Complexity: 'Low',
        Status: 'Migrated',
      }),
      e(
        'cut1',
        'CutoverPlan',
        280,
        230,
        {
          Name: 'Cut-over wave 1',
          Window: 'Sat 13 Nov, 22:00 to 06:00',
          Decision: 'Go',
          RollbackPlan: 'Point the reports back at the file share.',
        },
        { parent: 'wave1' },
      ),
      // Wave 2
      e(
        'wave2',
        'MigrationWave',
        460,
        170,
        {
          Name: 'Wave 2: Warehouse',
          Sequence: 2,
          Start: '2027-11-15',
          End: '2028-03-18',
        },
        { w: 400, h: 300 },
      ),
      workload('wl_dwh', 'wave2', 460, 0, {
        Name: 'Customer warehouse',
        WorkloadType: 'Data warehouse',
        SizeGB: 18000,
        Approach: 'Replatform',
        Complexity: 'High',
        Status: 'Ready',
        Owner: 'Head of data platform',
      }),
      workload('wl_jobs', 'wave2', 460, 1, {
        Name: 'Nightly loading jobs',
        WorkloadType: 'Loading jobs',
        Approach: 'Refactor',
        Complexity: 'High',
        Status: 'Assessed',
      }),
      workload('wl_regulatory', 'wave2', 460, 2, {
        Name: 'Regulatory reports',
        WorkloadType: 'Reports',
        SizeGB: 40,
        Approach: 'Replatform',
        Complexity: 'Medium',
        Status: 'Ready',
      }),
      e(
        'cut2',
        'CutoverPlan',
        700,
        230,
        {
          Name: 'Cut-over wave 2',
          Window: 'Easter weekend',
          Decision: 'Not decided',
          RollbackPlan:
            'Keep the old warehouse loading in parallel for four weeks.',
        },
        { parent: 'wave2' },
      ),
      // Wave 3
      e(
        'wave3',
        'MigrationWave',
        880,
        170,
        {
          Name: 'Wave 3: Risk and core',
          Sequence: 3,
          Start: '2028-04-03',
          End: '2028-09-30',
        },
        { w: 400, h: 300 },
      ),
      workload('wl_riskmart', 'wave3', 880, 0, {
        Name: 'Risk data mart',
        WorkloadType: 'Database',
        SizeGB: 2600,
        Approach: 'Replatform',
        Complexity: 'Medium',
        Status: 'Assessed',
      }),
      workload('wl_core', 'wave3', 880, 1, {
        Name: 'Core banking extracts',
        WorkloadType: 'Application data',
        SizeGB: 9500,
        Approach: 'Refactor',
        Complexity: 'High',
        Status: 'Not started',
      }),
      e(
        'cut3',
        'CutoverPlan',
        1120,
        230,
        {
          Name: 'Cut-over wave 3',
          Window: 'Last weekend of September',
          RollbackPlan: 'Switch the extracts back to the old servers.',
        },
        { parent: 'wave3' },
      ),
      // The cloud platform and its services
      e(
        'cloud',
        'CloudPlatform',
        40,
        540,
        {
          Name: 'Cloud data platform',
          Provider: 'Public cloud provider',
          Region: 'Home region',
        },
        { w: 1240, h: 150 },
      ),
      e(
        'tgt_storage',
        'TargetService',
        80,
        590,
        { Name: 'Object storage', ServiceType: 'Object storage' },
        { parent: 'cloud' },
      ),
      e(
        'tgt_database',
        'TargetService',
        380,
        590,
        { Name: 'Managed database', ServiceType: 'Managed database' },
        { parent: 'cloud' },
      ),
      e(
        'tgt_warehouse',
        'TargetService',
        680,
        590,
        { Name: 'Cloud warehouse', ServiceType: 'Data warehouse' },
        { parent: 'cloud' },
      ),
      e(
        'tgt_integration',
        'TargetService',
        980,
        590,
        { Name: 'Integration service', ServiceType: 'Integration service' },
        { parent: 'cloud' },
      ),
      // Risks
      e(
        'risk_window',
        'Risk',
        1340,
        200,
        {
          Name: 'Warehouse cut-over overruns the weekend',
          Likelihood: 3,
          Impact: 4,
          Owner: 'Head of data platform',
          Status: 'Open',
        },
        { w: 160, h: 120 },
      ),
      e(
        'risk_format',
        'Risk',
        1340,
        360,
        {
          Name: 'Core extracts change format',
          Likelihood: 2,
          Impact: 3,
          Owner: 'Core banking team',
          Status: 'Open',
        },
        { w: 160, h: 120 },
      ),
    ],
    connectors: [
      c('MovesFrom', 'wl_files', 'src_files'),
      c('MovesFrom', 'wl_reference', 'src_dwh'),
      c('MovesFrom', 'wl_dwh', 'src_dwh'),
      c('MovesFrom', 'wl_jobs', 'src_dwh'),
      c('MovesFrom', 'wl_regulatory', 'src_risk'),
      c('MovesFrom', 'wl_riskmart', 'src_risk'),
      c('MovesFrom', 'wl_core', 'src_core'),
      c('MovesTo', 'wl_files', 'tgt_storage'),
      c('MovesTo', 'wl_reference', 'tgt_database'),
      c('MovesTo', 'wl_dwh', 'tgt_warehouse'),
      c('MovesTo', 'wl_jobs', 'tgt_integration'),
      c('MovesTo', 'wl_regulatory', 'tgt_warehouse'),
      c('MovesTo', 'wl_riskmart', 'tgt_warehouse'),
      c('MovesTo', 'wl_core', 'tgt_storage'),
      c('DependsOn', 'wl_jobs', 'wl_dwh'),
      c('DependsOn', 'wl_regulatory', 'wl_riskmart'),
      c('DependsOn', 'wl_riskmart', 'wl_dwh'),
      c('HasRisk', 'wave2', 'risk_window'),
      c('HasRisk', 'wl_core', 'risk_format'),
    ],
  },
};
