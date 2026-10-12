import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
  int,
  line,
  long,
  look,
  text,
  type ClassSpec,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Event storming: the domain events of a business process on a timeline, the commands and
 * actors that cause them, the aggregates that handle them, the policies that react to them, the
 * read models people decide with, external systems and open questions (hotspots). Bounded
 * contexts are swimlanes, so the flow between stickies stays visible.
 */

/** A sticky note: a plain box in the colour of its kind. */
const sticky = (
  key: string,
  label: string,
  help: string,
  fill: string,
  border: string,
  attributes: ClassSpec['attributes'],
  extra: Partial<ClassSpec> = {},
): ClassSpec => ({
  key,
  label,
  help,
  look: look('box', { fill, border, width: 140, height: 80 }),
  attributes: [long('Description'), ...attributes],
  ...extra,
});

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

const STICKIES = [
  'DomainEvent',
  'Command',
  'Actor',
  'Aggregate',
  'Policy',
  'ReadModel',
  'ExternalSystem',
  'Hotspot',
];

export const eventStorming: KitSpec = {
  folder: 'event-storming',
  id: 'kit_eventstorming' as KitId,
  name: 'Event storming',
  catalog: { keys: [] },
  classes: [
    {
      key: 'BoundedContext',
      label: 'Bounded context',
      help: 'A part of the domain where words have one meaning and one team owns the model. A lane for its stickies.',
      kind: 'swimlane',
      look: look('swimlane', {
        fill: '#e9ecef',
        border: '#868e96',
        width: 1920,
        height: 300,
      }),
      attributes: [
        long('Description'),
        text('Team'),
        formula(
          'Stickies',
          'count(children())',
          'number',
          'How many stickies sit in it.',
        ),
      ],
    },
    {
      ...sticky(
        'DomainEvent',
        'Domain event',
        'Something that happened in the domain that experts care about, written in the past tense, such as "Order placed".',
        '#ffc078',
        '#e8590c',
        [
          int('Step', {
            min: 1,
            help: 'Its place on the timeline: 1 for the first event, then 2, 3 and so on.',
          }),
          formula(
            'Context',
            'parent ? parent.Name : null',
            'text',
            'The bounded context it sits in.',
          ),
          formula(
            'StepLabel',
            "Step == null ? null : 'Step ' + Step",
            'text',
            'Its step, shown under the name.',
            { label: 'Step label' },
          ),
        ],
      ),
      look: look('box', {
        fill: '#ffc078',
        border: '#e8590c',
        subtitle: 'StepLabel',
        width: 140,
        height: 80,
      }),
      constraints: [
        {
          id: 'k_event_order',
          formula:
            "Step == null || count(outgoing('LeadsTo').Step) == 0 || Step < min(outgoing('LeadsTo').Step)",
          message:
            "= 'Domain event \"' + Name + '\" leads to an event with the same or an earlier step: check the order of the timeline.'",
        },
      ],
    },
    sticky(
      'Command',
      'Command',
      'A request to do something, written as an instruction, such as "Place order". It may be refused.',
      '#74c0fc',
      '#1971c2',
      [],
      {
        constraints: [
          {
            id: 'k_command_event',
            formula:
              "count(outgoing('Raises')) + count(outgoing('HandledBy')) > 0",
            message:
              "= 'Command \"' + Name + '\" leads to nothing yet: connect the event it raises, or the aggregate or system that handles it.'",
          },
        ],
      },
    ),
    {
      key: 'Actor',
      label: 'Actor',
      help: 'A person or role who issues commands, such as a customer or a clerk.',
      look: look('person', {
        fill: '#fff3bf',
        border: '#f08c00',
        width: 80,
        height: 90,
      }),
      attributes: [long('Description')],
    },
    sticky(
      'Aggregate',
      'Aggregate',
      'The part of the model that receives commands, checks its rules and raises events, such as an order or an account.',
      '#ffec99',
      '#e67700',
      [
        long('Rules', {
          help: 'What must always be true, such as "a bike has one rider at a time".',
        }),
      ],
    ),
    sticky(
      'Policy',
      'Policy',
      'A reaction to an event: "whenever this happens, do that". It issues a command, by a person or automatically.',
      '#e599f7',
      '#ae3ec9',
      [choice('Kind', ['Automatic', 'Manual'])],
      {
        constraints: [
          {
            id: 'k_policy_command',
            formula: "count(outgoing('Issues')) > 0",
            message: "= 'Policy \"' + Name + '\" issues no command.'",
          },
        ],
      },
    ),
    sticky(
      'ReadModel',
      'Read model',
      'The information someone needs to take a decision, such as a list of free bikes.',
      '#b2f2bb',
      '#2f9e44',
      [],
    ),
    sticky(
      'ExternalSystem',
      'External system',
      'A system outside the domain that receives commands or raises events, such as a payment service.',
      '#fcc2d7',
      '#c2255c',
      [],
    ),
    {
      key: 'Hotspot',
      label: 'Hotspot',
      help: 'A question, a risk or a disagreement found during the session, to come back to.',
      look: look('diamond', {
        fill: {
          by: 'Status',
          values: { Open: '#ff8787', Answered: '#e9ecef' },
          fallback: '#ff8787',
        },
        border: '#c92a2a',
        icon: 'warning',
        width: 180,
        height: 110,
      }),
      attributes: [
        long('Question'),
        choice('Status', ['Open', 'Answered'], { default: 'Open' }),
        long('Answer'),
      ],
    },
  ],
  relations: [
    {
      key: 'Issues',
      label: 'Issues',
      help: 'The actor, policy or external system issues the command.',
      from: ['Actor', 'Policy', 'ExternalSystem'],
      to: ['Command'],
      look: line('#1971c2'),
    },
    {
      key: 'HandledBy',
      label: 'Handled by',
      help: 'The aggregate or external system receives the command.',
      from: ['Command'],
      to: ['Aggregate', 'ExternalSystem'],
      look: line('#e67700'),
    },
    {
      key: 'Raises',
      label: 'Raises',
      help: 'The aggregate, command or external system results in the event.',
      from: ['Aggregate', 'Command', 'ExternalSystem'],
      to: ['DomainEvent'],
      look: line('#e8590c'),
    },
    {
      key: 'Triggers',
      label: 'Triggers',
      help: 'The event sets off the policy.',
      from: ['DomainEvent'],
      to: ['Policy'],
      look: line('#ae3ec9'),
    },
    {
      key: 'Updates',
      label: 'Updates',
      help: 'The event changes what the read model shows.',
      from: ['DomainEvent'],
      to: ['ReadModel'],
      look: line('#2f9e44', { style: 'dashed' }),
    },
    {
      key: 'Informs',
      label: 'Informs',
      help: 'The read model gives the actor what they need to decide.',
      from: ['ReadModel'],
      to: ['Actor'],
      look: line('#2f9e44', { style: 'dotted' }),
    },
    {
      key: 'LeadsTo',
      label: 'Then',
      help: 'The next event on the timeline.',
      from: ['DomainEvent'],
      to: ['DomainEvent'],
      look: line('#868e96', { style: 'dotted' }),
    },
    {
      key: 'About',
      label: 'About',
      help: 'The hotspot is about this sticky.',
      from: ['Hotspot'],
      to: STICKIES.filter((k) => k !== 'Hotspot'),
      look: line('#c92a2a', { style: 'dotted', end: 'none' }),
    },
  ],
  modelTypes: [
    {
      key: 'EventStorm',
      label: 'Event storm',
      help: 'A timeline of domain events with the commands, actors, aggregates, policies, read models and external systems around them, in bounded contexts.',
      views: [
        {
          key: 'BigPicture',
          label: 'Big picture',
          classes: [
            'BoundedContext',
            'DomainEvent',
            'Actor',
            'ExternalSystem',
            'Hotspot',
          ],
          relations: ['LeadsTo', 'About'],
        },
      ],
      cardinalities: [{ kind: 'count', class: 'DomainEvent', min: 1 }],
      containers: { BoundedContext: STICKIES },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Facilitator'),
        text('SessionDate', { label: 'Session date' }),
        formula(
          'Events',
          "count(objects('DomainEvent'))",
          'number',
          'How many domain events the storm found.',
        ),
        formula(
          'Hotspots',
          "count(objects('Hotspot'))",
          'number',
          'How many hotspots were raised.',
        ),
      ],
    },
  ],
  sample: {
    file: 'bike-rental.mkmodel.json',
    id: 'mdl_bikerental',
    name: 'Bike rental',
    modelType: 'EventStorm',
    attributes: {
      Title: 'Bike rental',
      Facilitator: 'Lead developer',
      SessionDate: '2027-02-18',
    },
    // "Report damage" leads to nothing yet, on purpose.
    intendedWarnings: 1,
    elements: [
      e(
        'ctx_rental',
        'BoundedContext',
        20,
        20,
        { Name: 'Rental', Team: 'Rental team' },
        { w: 1920, h: 300 },
      ),
      e(
        'a_rider1',
        'Actor',
        60,
        45,
        { Name: 'Rider' },
        { parent: 'ctx_rental' },
      ),
      e(
        'c_reserve',
        'Command',
        150,
        50,
        { Name: 'Reserve bike' },
        { parent: 'ctx_rental' },
      ),
      e(
        'g_rental',
        'Aggregate',
        150,
        190,
        {
          Name: 'Rental',
          Rules:
            'A bike has one rider at a time. A reservation lasts 15 minutes.',
        },
        { parent: 'ctx_rental' },
      ),
      e(
        'ev_reserved',
        'DomainEvent',
        310,
        50,
        { Name: 'Bike reserved', Step: 1 },
        { parent: 'ctx_rental' },
      ),
      e(
        'rm_bikes',
        'ReadModel',
        310,
        190,
        { Name: 'Free bikes near me' },
        { parent: 'ctx_rental' },
      ),
      e(
        'a_rider2',
        'Actor',
        470,
        45,
        { Name: 'Rider' },
        { parent: 'ctx_rental' },
      ),
      e(
        'c_unlock',
        'Command',
        560,
        50,
        { Name: 'Unlock bike' },
        { parent: 'ctx_rental' },
      ),
      e(
        'c_damage',
        'Command',
        560,
        190,
        { Name: 'Report damage' },
        { parent: 'ctx_rental' },
      ),
      e(
        'ev_unlocked',
        'DomainEvent',
        720,
        50,
        { Name: 'Bike unlocked', Step: 2 },
        { parent: 'ctx_rental' },
      ),
      e(
        'a_rider3',
        'Actor',
        880,
        45,
        { Name: 'Rider' },
        { parent: 'ctx_rental' },
      ),
      e(
        'c_end',
        'Command',
        970,
        50,
        { Name: 'End ride' },
        { parent: 'ctx_rental' },
      ),
      e(
        'h_station',
        'Hotspot',
        950,
        175,
        {
          Name: 'Ride ends off station?',
          Question:
            'What happens when a rider ends a ride away from a station?',
          Status: 'Open',
        },
        { parent: 'ctx_rental' },
      ),
      e(
        'ev_ended',
        'DomainEvent',
        1130,
        50,
        { Name: 'Ride ended', Step: 3 },
        { parent: 'ctx_rental' },
      ),
      e(
        'ctx_billing',
        'BoundedContext',
        20,
        350,
        { Name: 'Billing', Team: 'Payments team' },
        { w: 1920, h: 290 },
      ),
      e(
        'pol_charge',
        'Policy',
        1290,
        390,
        { Name: 'When a ride ends, charge it', Kind: 'Automatic' },
        { parent: 'ctx_billing' },
      ),
      e(
        'c_charge',
        'Command',
        1450,
        390,
        { Name: 'Charge ride' },
        { parent: 'ctx_billing' },
      ),
      e(
        'g_account',
        'Aggregate',
        1450,
        520,
        { Name: 'Account', Rules: 'A ride is charged once.' },
        { parent: 'ctx_billing' },
      ),
      e(
        'ev_charged',
        'DomainEvent',
        1610,
        390,
        { Name: 'Ride charged', Step: 4 },
        { parent: 'ctx_billing' },
      ),
      e(
        'ev_failed',
        'DomainEvent',
        1610,
        520,
        { Name: 'Payment failed', Step: 5 },
        { parent: 'ctx_billing' },
      ),
      e(
        'x_payments',
        'ExternalSystem',
        1770,
        520,
        { Name: 'Payment provider' },
        { parent: 'ctx_billing' },
      ),
    ],
    connectors: [
      c('Issues', 'a_rider1', 'c_reserve'),
      c('HandledBy', 'c_reserve', 'g_rental'),
      c('Raises', 'g_rental', 'ev_reserved'),
      c('Updates', 'ev_reserved', 'rm_bikes'),
      c('Issues', 'a_rider2', 'c_unlock'),
      c('Issues', 'a_rider2', 'c_damage'),
      c('Raises', 'c_unlock', 'ev_unlocked'),
      c('Issues', 'a_rider3', 'c_end'),
      c('Raises', 'c_end', 'ev_ended'),
      c('About', 'h_station', 'c_end'),
      c('Triggers', 'ev_ended', 'pol_charge'),
      c('LeadsTo', 'ev_ended', 'ev_charged'),
      c('Issues', 'pol_charge', 'c_charge'),
      c('HandledBy', 'c_charge', 'g_account'),
      c('Raises', 'g_account', 'ev_charged'),
      c('Raises', 'x_payments', 'ev_failed'),
    ],
  },
};
