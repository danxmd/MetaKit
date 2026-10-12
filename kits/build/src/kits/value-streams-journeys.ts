import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
  int,
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
 * Value streams and customer journeys: a value stream includes stages; each stage holds the
 * touchpoints where the customer meets the organisation, scored by emotion, with the pain points
 * that hurt them and the opportunities that address those. Metrics measure stages.
 */

const CHANNELS = [
  'Website',
  'Mobile app',
  'Phone',
  'Email',
  'Letter',
  'Shop',
  'Chat',
  'Social media',
  'In person',
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

// The sample: five stages side by side, each with two touchpoints, a pain point and an
// opportunity at fixed rows.
const STAGE_X = (i: number) => 40 + i * 300;
const STAGE_Y = 120;
const inStage = (
  i: number,
  id: string,
  cls: string,
  rowY: number,
  attributes: SampleElement['attributes'],
) =>
  e(id, cls, STAGE_X(i) + 30, STAGE_Y + rowY, attributes, {
    parent: `st_${i + 1}`,
  });
const touch = (
  i: number,
  row: 0 | 1,
  id: string,
  name: string,
  channel: string,
  emotion: number,
) =>
  inStage(i, id, 'Touchpoint', 50 + row * 90, {
    Name: name,
    Channel: channel,
    Emotion: emotion,
  });

const STAGES: [string, string][] = [
  ['Discover', 'Find a good offer for the new flat.'],
  ['Choose and order', 'Be sure the speed is right, then order.'],
  ['Wait for installation', 'Know when the line will work.'],
  ['Installation day', 'Get connected without losing a day.'],
  ['First month', 'Pay what was promised and get the speed.'],
];

export const valueStreamsJourneys: KitSpec = {
  folder: 'value-streams-journeys',
  id: 'kit_valuejourneys' as KitId,
  name: 'Value streams and customer journeys',
  catalog: { keys: ['ValueStream', 'KPI'] },
  classes: [
    {
      key: 'Stage',
      label: 'Stage',
      help: 'A stage of the journey or value stream, such as "Choose and order". Place its touchpoints, pain points and opportunities inside it.',
      kind: 'container',
      look: look('container', {
        fill: {
          by: 'Mood',
          // See-through, so the steps of the journey stay visible between stages.
          values: {
            Positive: '#d3f9d866',
            Neutral: '#f1f3f566',
            Negative: '#ffc9c966',
          },
          fallback: '#f1f3f566',
        },
        border: '#2f9e44',
        title: 'Heading',
        width: 250,
        height: 480,
      }),
      attributes: [
        int('Order', { min: 1, help: 'Its place in the journey: 1, 2, 3 …' }),
        long('CustomerGoal', {
          help: 'What the customer wants to achieve in this stage.',
        }),
        formula(
          'AverageEmotion',
          'IFERROR(round(avg(children().Emotion), 1), null)',
          'number',
          'The average emotion of the touchpoints inside, from -2 to +2.',
        ),
        formula(
          'Mood',
          "AverageEmotion == null ? null : (AverageEmotion >= 0.5 ? 'Positive' : (AverageEmotion > -0.5 ? 'Neutral' : 'Negative'))",
          'text',
          'Positive from an average emotion of 0.5, Negative from -0.5 down, otherwise Neutral. The fill shows it.',
        ),
        formula(
          'PainPoints',
          'count(children().Severity)',
          'number',
          'How many pain points sit inside.',
        ),
        formula(
          'Heading',
          "(Order == null ? '' : Order + '. ') + Name + (AverageEmotion == null ? '' : ', mood ' + AverageEmotion)",
          'text',
          'The order, the name and the average emotion, shown as the heading.',
        ),
      ],
    },
    {
      key: 'Touchpoint',
      label: 'Touchpoint',
      help: 'A step where the customer meets the organisation, through a channel, and how they feel about it.',
      look: look('rounded', {
        fill: {
          by: 'Feeling',
          values: {
            Happy: '#b2f2bb',
            Neutral: '#fff3bf',
            Unhappy: '#ffc9c9',
          },
          fallback: '#e9ecef',
        },
        border: '#2f9e44',
        subtitle: 'Summary',
        width: 190,
        height: 60,
      }),
      attributes: [
        long('CustomerAction', {
          help: 'What the customer does or experiences here.',
        }),
        choice('Channel', CHANNELS),
        int('Emotion', {
          label: 'Emotion (-2 to +2)',
          min: -2,
          max: 2,
          help: '-2 very unhappy, 0 neutral, +2 very happy.',
        }),
        text('Owner', { help: 'The team responsible for this touchpoint.' }),
        formula(
          'Feeling',
          "Emotion == null ? null : (Emotion > 0 ? 'Happy' : (Emotion == 0 ? 'Neutral' : 'Unhappy'))",
          'text',
          'Happy above 0, Unhappy below 0, otherwise Neutral. The fill shows it.',
        ),
        formula(
          'Summary',
          "(Channel ?? '') + (Emotion == null ? '' : (Channel ? ', ' : '') + (Emotion > 0 ? '+' : '') + Emotion)",
          'text',
          'The channel and the emotion, shown on the diagram.',
        ),
        formula(
          'PainPoints',
          "count(incoming('Hurts'))",
          'number',
          'How many pain points hurt this touchpoint.',
        ),
      ],
      constraints: [
        {
          id: 'k_touchpoint_stage',
          formula: 'parent != null',
          message: "= 'Touchpoint \"' + Name + '\" is not inside a stage.'",
        },
        {
          id: 'k_touchpoint_channel',
          formula: 'Channel != null',
          message: "= 'Touchpoint \"' + Name + '\" has no channel.'",
        },
      ],
    },
    {
      key: 'PainPoint',
      label: 'Pain point',
      help: 'Something that annoys or blocks the customer at a touchpoint, and how bad it is.',
      look: look('pill', {
        fill: {
          by: 'Severity',
          values: { Low: '#fff3bf', Medium: '#ffd8a8', High: '#ffa8a8' },
          fallback: '#ffd8a8',
        },
        border: '#e03131',
        icon: 'warning',
        subtitle: 'Severity',
        width: 190,
        height: 56,
      }),
      attributes: [
        long('Description'),
        choice('Severity', ['Low', 'Medium', 'High'], { required: true }),
        long('Cause'),
      ],
      constraints: [
        {
          id: 'k_pain_touchpoint',
          formula: "count(outgoing('Hurts')) > 0",
          message:
            '= \'Pain point "\' + Name + \'" hurts no touchpoint: connect it with "Hurts".\'',
        },
        {
          id: 'k_pain_opportunity',
          formula: "Severity != 'High' || count(incoming('Addresses')) > 0",
          message:
            "= 'Pain point \"' + Name + '\" is severe, but no opportunity addresses it.'",
        },
      ],
    },
    {
      key: 'Opportunity',
      label: 'Opportunity',
      help: 'An idea to remove a pain point or make a touchpoint better, rated on value and effort.',
      look: look('rounded', {
        fill: '#e5dbff',
        border: '#6741d9',
        icon: 'star',
        subtitle: 'Rating',
        width: 190,
        height: 60,
      }),
      attributes: [
        long('Description'),
        scale('Value', {
          help: 'How much it helps the customer and the business.',
        }),
        scale('Effort', { help: 'How much work it takes.' }),
        choice('Status', ['Idea', 'Planned', 'In progress', 'Done'], {
          default: 'Idea',
        }),
        formula(
          'Priority',
          'Value == null || Effort == null ? null : Value * (6 - Effort)',
          'number',
          'Value times (6 minus effort), from 1 to 25: high value and low effort come first.',
        ),
        formula(
          'Rating',
          "(Status ?? 'Idea') + (Priority == null ? '' : ', priority ' + Priority)",
          'text',
          'The status and the priority, shown on the diagram.',
        ),
      ],
      constraints: [
        {
          id: 'k_opportunity_addresses',
          formula: "count(outgoing('Addresses')) > 0",
          message:
            "= 'Opportunity \"' + Name + '\" addresses nothing: connect it to a pain point or touchpoint.'",
        },
      ],
    },
  ],
  amend: {
    ValueStream: {
      help: 'The stages through which value reaches a customer, from first need to final result. Connect it to its stages with "Includes".',
      attributes: [
        formula(
          'Stages',
          "count(outgoing('Includes'))",
          'number',
          'How many stages it includes.',
        ),
      ],
      look: look('pill', {
        fill: '#b2f2bb',
        border: '#2f9e44',
        icon: 'flag',
        subtitle: 'Customer',
        width: 320,
        height: 56,
      }),
    },
    KPI: {
      label: 'Metric',
      help: 'A number with a target that shows how well a stage, touchpoint or value stream does.',
      attributes: [
        formula(
          'Reading',
          "(Current == null ? '-' : text(Current)) + (Unit ? ' ' + Unit : '') + ', target ' + (Target == null ? '-' : text(Target))",
          'text',
          'The current value and the target, shown on the diagram.',
        ),
      ],
      look: look('rounded', {
        fill: {
          by: 'OnTrack',
          values: { true: '#b2f2bb', false: '#ffc9c9' },
          fallback: '#e9ecef',
        },
        border: '#2f9e44',
        icon: 'flag',
        subtitle: 'Reading',
        width: 190,
        height: 60,
      }),
      constraints: [
        {
          id: 'k_metric_measures',
          formula: "count(outgoing('Measures')) > 0",
          message:
            '= \'Metric "\' + Name + \'" measures nothing: connect it with "Measures".\'',
        },
      ],
    },
  },
  relations: [
    {
      key: 'Includes',
      label: 'Includes',
      help: 'The value stream goes through the stage.',
      from: ['ValueStream'],
      to: ['Stage'],
      look: line('#2f9e44', { style: 'dotted' }),
    },
    {
      key: 'Then',
      label: 'Then',
      help: 'The customer goes on from one touchpoint to the next.',
      from: ['Touchpoint'],
      to: ['Touchpoint'],
      look: line('#495057'),
    },
    {
      key: 'Hurts',
      label: 'Hurts',
      help: 'The pain point spoils the touchpoint.',
      from: ['PainPoint'],
      to: ['Touchpoint'],
      look: line('#e03131', { style: 'dashed' }),
    },
    {
      key: 'Addresses',
      label: 'Addresses',
      help: 'The opportunity removes the pain point or improves the touchpoint.',
      from: ['Opportunity'],
      to: ['PainPoint', 'Touchpoint'],
      look: line('#6741d9'),
    },
    {
      key: 'Measures',
      label: 'Measures',
      help: 'The metric shows how well the stage, touchpoint or value stream does.',
      from: ['KPI'],
      to: ['Stage', 'Touchpoint', 'ValueStream'],
      look: line('#2f9e44', { style: 'dotted' }),
    },
  ],
  modelTypes: [
    {
      key: 'JourneyMap',
      label: 'Customer journey map',
      help: 'A value stream with its stages, touchpoints scored by emotion, pain points, opportunities and metrics.',
      views: [
        {
          key: 'Journey',
          label: 'Journey',
          classes: ['Stage', 'Touchpoint', 'PainPoint', 'Opportunity'],
          relations: ['Then', 'Hurts', 'Addresses'],
        },
        {
          key: 'ValueStream',
          label: 'Value stream',
          classes: ['ValueStream', 'Stage', 'KPI'],
          relations: ['Includes', 'Measures'],
        },
      ],
      containers: { Stage: ['Touchpoint', 'PainPoint', 'Opportunity'] },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Persona', { help: 'Who the journey is about.' }),
        long('Scenario'),
        formula(
          'AverageEmotion',
          "IFERROR(round(avg(objects('Touchpoint').Emotion), 1), null)",
          'number',
          'The average emotion of all touchpoints.',
        ),
        formula(
          'PainPoints',
          "count(objects('PainPoint'))",
          'number',
          'How many pain points the journey has.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'Touchpoint',
      tabs: [
        {
          label: 'Touchpoint',
          items: [
            'Name',
            { attribute: 'Channel', control: 'select' },
            'Emotion',
            'Feeling',
            { attribute: 'CustomerAction', control: 'textarea' },
            'Owner',
            'PainPoints',
          ],
        },
      ],
      showRelations: true,
    },
    {
      class: 'Opportunity',
      tabs: [
        {
          label: 'Opportunity',
          items: [
            'Name',
            { attribute: 'Description', control: 'textarea' },
            'Value',
            'Effort',
            'Priority',
            { attribute: 'Status', control: 'segmented' },
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'broadband-journey.mkmodel.json',
    id: 'mdl_broadbandjourney',
    name: 'Getting broadband at home',
    modelType: 'JourneyMap',
    attributes: {
      Title: 'Getting broadband at home',
      Persona: 'Sam, moving into a new flat',
      Scenario:
        'Sam needs fast internet from the first week in a new flat and works from home twice a week.',
    },
    // "Waits at home all day" is severe and no opportunity addresses it yet, on purpose.
    intendedWarnings: 1,
    elements: [
      e('vs', 'ValueStream', 580, 20, {
        Name: 'Get connected at home',
        Customer: 'New home customer',
        ValueProposition: 'Fast, reliable internet from the day you move in.',
      }),
      ...STAGES.map(([name, goal], i) =>
        e(
          `st_${i + 1}`,
          'Stage',
          STAGE_X(i),
          STAGE_Y,
          { Name: name, Order: i + 1, CustomerGoal: goal },
          { w: 250, h: 480 },
        ),
      ),
      touch(0, 0, 't_ad', 'Sees an advert', 'Social media', 0),
      touch(0, 1, 't_compare', 'Compares offers online', 'Website', 1),
      touch(1, 0, 't_choose', 'Chooses a package', 'Website', 1),
      touch(1, 1, 't_check', 'Checks the speed at the address', 'Website', -1),
      touch(2, 0, 't_confirm', 'Gets the order confirmation', 'Email', 0),
      touch(2, 1, 't_date', 'Is offered an installation date', 'Email', -2),
      touch(3, 0, 't_reminder', 'Gets a reminder the day before', 'Email', 0),
      touch(3, 1, 't_visit', 'Engineer connects the line', 'In person', 0),
      touch(4, 0, 't_bill', 'First bill arrives', 'Email', 0),
      touch(4, 1, 't_call', 'Calls about slow evenings', 'Phone', -2),
      inStage(1, 'p_range', 'PainPoint', 250, {
        Name: 'Speed shown as a wide range',
        Severity: 'Medium',
      }),
      inStage(2, 'p_wait', 'PainPoint', 250, {
        Name: 'First free date is three weeks away',
        Severity: 'High',
      }),
      inStage(3, 'p_day', 'PainPoint', 250, {
        Name: 'Waits at home all day',
        Severity: 'High',
        Cause: 'Visits are booked for the whole day, not for a time slot.',
      }),
      inStage(4, 'p_evening', 'PainPoint', 250, {
        Name: 'Speed drops in the evening',
        Severity: 'Medium',
        Cause: 'The street cabinet is busy when everyone streams.',
      }),
      inStage(1, 'o_speed', 'Opportunity', 370, {
        Name: 'Show the speed for the exact flat',
        Value: 4,
        Effort: 3,
        Status: 'Planned',
      }),
      inStage(2, 'o_slots', 'Opportunity', 370, {
        Name: 'Let customers pick a slot online',
        Value: 5,
        Effort: 3,
        Status: 'In progress',
      }),
      inStage(4, 'o_check', 'Opportunity', 370, {
        Name: 'Check the line a week after installation',
        Value: 4,
        Effort: 2,
        Status: 'Idea',
      }),
      e('k_days', 'KPI', STAGE_X(2) + 30, 640, {
        Name: 'Days from order to installation',
        Unit: 'days',
        Target: 7,
        Current: 18,
        Direction: 'Lower is better',
      }),
      e('k_satisfaction', 'KPI', STAGE_X(3) + 30, 640, {
        Name: 'Satisfaction after installation',
        Unit: 'of 10',
        Target: 8,
        Current: 8.3,
        Direction: 'Higher is better',
      }),
      e('k_calls', 'KPI', STAGE_X(4) + 30, 640, {
        Name: 'Calls in the first month',
        Unit: 'per 100',
        Target: 15,
        Current: 24,
        Direction: 'Lower is better',
      }),
    ],
    connectors: [
      ...[1, 2, 3, 4, 5].map((i) => c('Includes', 'vs', `st_${i}`)),
      c('Then', 't_ad', 't_compare'),
      c('Then', 't_compare', 't_choose'),
      c('Then', 't_choose', 't_check'),
      c('Then', 't_check', 't_confirm'),
      c('Then', 't_confirm', 't_date'),
      c('Then', 't_date', 't_reminder'),
      c('Then', 't_reminder', 't_visit'),
      c('Then', 't_visit', 't_bill'),
      c('Then', 't_bill', 't_call'),
      c('Hurts', 'p_range', 't_check'),
      c('Hurts', 'p_wait', 't_date'),
      c('Hurts', 'p_day', 't_visit'),
      c('Hurts', 'p_evening', 't_call'),
      c('Addresses', 'o_speed', 'p_range'),
      c('Addresses', 'o_slots', 'p_wait'),
      c('Addresses', 'o_check', 'p_evening'),
      c('Measures', 'k_days', 'st_3'),
      c('Measures', 'k_satisfaction', 'st_4'),
      c('Measures', 'k_calls', 'st_5'),
    ],
  },
};
