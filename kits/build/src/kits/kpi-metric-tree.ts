import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
  line,
  look,
  num,
  text,
  type KitSpec,
  type PanelSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * KPI and metric tree: outcome KPIs are explained by driver metrics, which are explained by
 * operational metrics. Every metric has a target (fixed, or derived from a baseline), a current
 * value and a direction, and its fill shows whether it is on track.
 */

const ON_TRACK_FILL = {
  by: 'OnTrack',
  values: { true: '#b2f2bb', false: '#ffc9c9' },
  fallback: '#e9ecef',
};

const METRIC_PANEL = (cls: string): PanelSpec => ({
  class: cls,
  tabs: [
    {
      label: 'Metric',
      items: [
        'Name',
        'Owner',
        'Unit',
        { attribute: 'Frequency', control: 'select' },
        { attribute: 'Description', control: 'textarea' },
      ],
    },
    {
      label: 'Target',
      items: [
        { attribute: 'Direction', control: 'segmented' },
        'Baseline',
        'TargetChange',
        'Target',
        'TargetValue',
        'Current',
        'OnTrack',
        'Attainment',
      ],
    },
  ],
  showRelations: true,
});

const drivesSomething = (what: string) => ({
  id: `k_${what.toLowerCase().replace(/ /g, '')}_drives`,
  formula: "count(outgoing('Drives')) > 0",
  message: `= '${what} "' + Name + '" drives nothing: connect it to the metric or KPI it explains with "Drives".'`,
});

type Values = Record<string, string | number>;
const metric = (
  id: string,
  cls: 'OutcomeKPI' | 'DriverMetric' | 'OperationalMetric',
  x: number,
  y: number,
  values: Values,
): SampleElement => ({
  id,
  class: cls,
  x,
  y,
  attributes: { Direction: 'Higher is better', ...values },
});
const drives = (
  from: string,
  to: string,
  weight: number,
  effect: 'Raises' | 'Lowers' = 'Raises',
): SampleConnector => ({
  relation: 'Drives',
  from,
  to,
  attributes: { Weight: weight, Effect: effect },
});

export const kpiMetricTree: KitSpec = {
  folder: 'kpi-metric-tree',
  id: 'kit_kpitree' as KitId,
  name: 'KPI and metric tree',
  catalog: { keys: ['Goal', 'KPI'] },
  amend: {
    KPI: {
      help: 'Anything measured against a target. Use one of its three kinds: outcome KPI, driver metric or operational metric.',
      abstract: true,
      look: null,
      attributes: [
        text('Owner'),
        choice('Frequency', [
          'Daily',
          'Weekly',
          'Monthly',
          'Quarterly',
          'Yearly',
        ]),
        num('Baseline', { help: 'The value when the target was set.' }),
        num('TargetChange', {
          label: 'Planned change',
          unit: '%',
          help: 'The planned change against the baseline, such as 15 for 15% more.',
        }),
        num('Target', {
          help: 'A fixed target. Leave it empty to derive the target from the baseline and the planned change.',
        }),
        formula(
          'TargetValue',
          'Target ?? (Baseline == null || TargetChange == null ? null : round(Baseline * (1 + TargetChange / 100), 4))',
          'number',
          'The fixed target, or the baseline with the planned change applied.',
          { label: 'Target used' },
        ),
        formula(
          'OnTrack',
          "Current == null || TargetValue == null ? null : (Direction == 'Lower is better' ? Current <= TargetValue : Current >= TargetValue)",
          'boolean',
          'Yes when the current value has reached the target in the given direction.',
        ),
        formula(
          'Attainment',
          "IFERROR(Current == null || TargetValue == null ? null : round((Direction == 'Lower is better' ? TargetValue / Current : Current / TargetValue) * 100, 1), null)",
          'number',
          'How much of the target is reached, in percent. Above 100 is better than the target.',
          { label: 'Attainment (%)' },
        ),
        formula(
          'Reading',
          "(Current == null ? '-' : text(Current)) + (Unit ? ' ' + Unit : '') + ', target ' + (TargetValue == null ? '-' : text(TargetValue))",
          'text',
          'The current value and the target, shown on the diagram.',
          { label: 'Current and target' },
        ),
        formula(
          'Drivers',
          "count(incoming('Drives'))",
          'number',
          'How many metrics drive this one.',
        ),
      ],
      constraints: [
        {
          id: 'k_kpi_target',
          formula: 'TargetValue != null',
          message:
            "= '\"' + Name + '\" has no target: give it a target, or a baseline and a planned change.'",
        },
      ],
    },
  },
  classes: [
    {
      key: 'OutcomeKPI',
      label: 'Outcome KPI',
      help: 'A result the organisation is judged by, such as revenue or customer satisfaction.',
      extends: 'KPI',
      look: look('hexagon', {
        fill: ON_TRACK_FILL,
        border: '#2f9e44',
        borderWidth: 2.5,
        subtitle: 'Reading',
        width: 200,
        height: 90,
      }),
      attributes: [],
      constraints: [
        {
          id: 'k_outcome_drivers',
          formula: 'Drivers > 0',
          message:
            "= 'Outcome KPI \"' + Name + '\" has no driver metrics yet.'",
        },
      ],
    },
    {
      key: 'DriverMetric',
      label: 'Driver metric',
      help: 'A metric that explains an outcome KPI, such as conversion rate for revenue.',
      extends: 'KPI',
      look: look('rounded', {
        fill: ON_TRACK_FILL,
        border: '#1c7ed6',
        borderWidth: 2,
        subtitle: 'Reading',
        width: 180,
      }),
      attributes: [],
      constraints: [drivesSomething('Driver metric')],
    },
    {
      key: 'OperationalMetric',
      label: 'Operational metric',
      help: 'A metric of day-to-day work that a team can change directly, such as page load time.',
      extends: 'KPI',
      look: look('pill', {
        fill: ON_TRACK_FILL,
        border: '#868e96',
        subtitle: 'Reading',
        width: 180,
        height: 54,
      }),
      attributes: [],
      constraints: [drivesSomething('Operational metric')],
    },
  ],
  relations: [
    {
      key: 'Drives',
      label: 'Drives',
      help: 'The metric explains part of the one it points to.',
      from: ['DriverMetric', 'OperationalMetric'],
      to: ['OutcomeKPI', 'DriverMetric'],
      attributes: [
        num('Weight', {
          unit: '%',
          min: 0,
          max: 100,
          help: 'How much of the target metric it explains, as a share.',
        }),
        choice('Effect', ['Raises', 'Lowers'], {
          help: 'Whether a higher value of this metric raises or lowers the one it drives.',
        }),
      ],
      look: line('#495057', { label: 'Weight' }),
    },
  ],
  modelTypes: [
    {
      key: 'MetricTree',
      label: 'Metric tree',
      help: 'Goals measured by outcome KPIs, explained by driver metrics and operational metrics.',
      views: [
        {
          key: 'Outcomes',
          label: 'Outcomes',
          classes: ['Goal', 'OutcomeKPI', 'DriverMetric'],
          relations: ['Measures', 'Drives'],
        },
      ],
      cardinalities: [{ kind: 'count', class: 'OutcomeKPI', min: 1 }],
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Period', { label: 'Reporting period' }),
        text('Owner'),
      ],
    },
  ],
  panels: [
    METRIC_PANEL('OutcomeKPI'),
    METRIC_PANEL('DriverMetric'),
    METRIC_PANEL('OperationalMetric'),
  ],
  rules: [
    {
      id: 'rule_offtrack',
      label: 'Warn when a metric goes off track',
      when: { event: 'attribute.changed', class: 'KPI', attribute: 'Current' },
      if: '= OnTrack == false',
      then: [
        {
          action: 'message',
          kind: 'warning',
          text: "= '\"' + Name + '\" is off track: ' + Reading + '.'",
        },
      ],
    },
  ],
  sample: {
    file: 'online-store.mkmodel.json',
    id: 'mdl_onlinestore',
    name: 'Online store growth',
    modelType: 'MetricTree',
    attributes: {
      Title: 'Online store growth',
      Period: '2027',
      Owner: 'Head of online sales',
    },
    // "Social media followers" drives nothing, on purpose.
    intendedWarnings: 1,
    elements: [
      {
        id: 'goal',
        class: 'Goal',
        x: 600,
        y: 20,
        w: 200,
        h: 80,
        attributes: {
          Name: 'Grow profitable online sales',
          Horizon: 'Medium term',
          Measure: 'Online revenue',
        },
      },
      metric('revenue', 'OutcomeKPI', 330, 160, {
        Name: 'Online revenue',
        Unit: 'million',
        Owner: 'Head of online sales',
        Frequency: 'Monthly',
        Baseline: 40,
        TargetChange: 15,
        Current: 43.5,
      }),
      metric('satisfaction', 'OutcomeKPI', 870, 160, {
        Name: 'Customer satisfaction',
        Unit: 'points',
        Owner: 'Head of customer service',
        Frequency: 'Quarterly',
        Target: 45,
        Current: 47,
      }),
      metric('conversion', 'DriverMetric', 40, 320, {
        Name: 'Conversion rate',
        Unit: '%',
        Frequency: 'Weekly',
        Target: 3.2,
        Current: 2.9,
      }),
      metric('ordervalue', 'DriverMetric', 250, 320, {
        Name: 'Average order value',
        Unit: 'per order',
        Frequency: 'Weekly',
        Target: 68,
        Current: 70,
      }),
      metric('returning', 'DriverMetric', 460, 320, {
        Name: 'Returning customers',
        Unit: '%',
        Frequency: 'Monthly',
        Target: 35,
        Current: 36,
      }),
      metric('ontime', 'DriverMetric', 780, 320, {
        Name: 'Deliveries on time',
        Unit: '%',
        Frequency: 'Weekly',
        Target: 95,
        Current: 92,
      }),
      metric('response', 'DriverMetric', 990, 320, {
        Name: 'Support response time',
        Unit: 'hours',
        Direction: 'Lower is better',
        Frequency: 'Weekly',
        Target: 4,
        Current: 3.5,
      }),
      metric('loadtime', 'OperationalMetric', 20, 480, {
        Name: 'Checkout page load time',
        Unit: 'seconds',
        Direction: 'Lower is better',
        Owner: 'Web team',
        Frequency: 'Daily',
        Target: 2,
        Current: 2.6,
      }),
      metric('stock', 'OperationalMetric', 220, 480, {
        Name: 'Stock availability',
        Unit: '%',
        Owner: 'Buying team',
        Frequency: 'Daily',
        Target: 97,
        Current: 98.1,
      }),
      metric('abandonment', 'OperationalMetric', 420, 480, {
        Name: 'Cart abandonment',
        Unit: '%',
        Direction: 'Lower is better',
        Owner: 'Web team',
        Frequency: 'Weekly',
        Target: 65,
        Current: 70,
      }),
      metric('emails', 'OperationalMetric', 620, 480, {
        Name: 'Email campaigns sent',
        Unit: 'per month',
        Owner: 'Marketing team',
        Frequency: 'Monthly',
        Target: 8,
        Current: 8,
      }),
      metric('picked', 'OperationalMetric', 820, 480, {
        Name: 'Orders picked the same day',
        Unit: '%',
        Owner: 'Warehouse team',
        Frequency: 'Daily',
        Baseline: 80,
        TargetChange: 12.5,
        Current: 84,
      }),
      metric('tickets', 'OperationalMetric', 1020, 480, {
        Name: 'Tickets per agent',
        Unit: 'per day',
        Direction: 'Lower is better',
        Owner: 'Customer service',
        Frequency: 'Daily',
        Target: 30,
        Current: 26,
      }),
      metric('followers', 'OperationalMetric', 1220, 480, {
        Name: 'Social media followers',
        Unit: 'thousand',
        Owner: 'Marketing team',
        Frequency: 'Monthly',
        Target: 120,
        Current: 131,
      }),
    ],
    connectors: [
      { relation: 'Measures', from: 'revenue', to: 'goal' },
      { relation: 'Measures', from: 'satisfaction', to: 'goal' },
      drives('conversion', 'revenue', 40),
      drives('ordervalue', 'revenue', 35),
      drives('returning', 'revenue', 25),
      drives('ontime', 'satisfaction', 50),
      drives('response', 'satisfaction', 50, 'Lowers'),
      drives('loadtime', 'conversion', 50, 'Lowers'),
      drives('stock', 'conversion', 30),
      drives('abandonment', 'conversion', 20, 'Lowers'),
      drives('emails', 'returning', 40),
      drives('picked', 'ontime', 70),
      drives('tickets', 'response', 60),
    ],
  },
};
