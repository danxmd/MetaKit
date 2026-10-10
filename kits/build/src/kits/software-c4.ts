import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
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
 * Software architecture at the levels of the C4 approach: people and software systems (context),
 * the containers inside a system (applications and data stores), and the components inside a
 * container. Boundaries are swimlanes, so the lines between the parts inside them stay visible.
 */

const tag = (kind: string) =>
  formula(
    'Tag',
    `'[' + ${kind} + (isEmpty(Technology) ? '' : ': ' + Technology) + ']'`,
    'text',
    'The kind and the technology, shown under the name.',
  );

const boundary = (
  key: string,
  label: string,
  help: string,
  holds: string,
): ClassSpec => ({
  key,
  label,
  help,
  kind: 'swimlane',
  look: {
    ...look('swimlane', {
      fill: '#e7f5ff',
      border: '#1864ab',
      width: 960,
      height: 380,
    }),
    borderStyle: 'dashed',
  },
  attributes: [
    long('Description'),
    formula(
      'Parts',
      'count(children())',
      'number',
      `How many ${holds} it holds.`,
    ),
  ],
});

const connected = (what: string) => ({
  id: `k_${what.toLowerCase().replace(/ /g, '')}_used`,
  formula: "count(outgoing('Uses')) + count(incoming('Uses')) > 0",
  message: `= '${what} "' + Name + '" has no relationships: connect it with "Uses".'`,
});

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
  extra: Partial<SampleElement> = {},
): SampleElement => ({ id, class: cls, x, y, attributes, ...extra });
const uses = (
  from: string,
  to: string,
  description?: string,
  technology?: string,
): SampleConnector => ({
  relation: 'Uses',
  from,
  to,
  attributes: {
    ...(description ? { Description: description } : {}),
    ...(technology ? { Technology: technology } : {}),
  },
});

const PEOPLE_AND_SYSTEMS = ['Person', 'SoftwareSystem', 'ExternalSystem'];

export const softwareC4: KitSpec = {
  folder: 'software-c4',
  id: 'kit_c4' as KitId,
  name: 'Software architecture (C4-style)',
  catalog: { keys: [] },
  classes: [
    {
      key: 'Person',
      label: 'Person',
      help: 'A user of the software, inside or outside the organisation.',
      look: look('person', {
        fill: {
          by: 'Location',
          values: { Internal: '#a5d8ff', External: '#dee2e6' },
          fallback: '#a5d8ff',
        },
        border: '#1864ab',
      }),
      attributes: [
        long('Description'),
        choice('Location', ['Internal', 'External'], { default: 'External' }),
      ],
      constraints: [connected('Person')],
    },
    {
      key: 'SoftwareSystem',
      label: 'Software system',
      help: 'Software that delivers value to its users, built and owned by one team or organisation. The highest level of the model.',
      look: look('rounded', {
        fill: '#74c0fc',
        border: '#1864ab',
        borderWidth: 2,
        subtitle: 'Tag',
        width: 200,
        height: 90,
      }),
      attributes: [
        long('Description'),
        text('Owner'),
        formula(
          'Tag',
          "'[Software system]'",
          'text',
          'The kind, shown under the name.',
        ),
      ],
    },
    {
      key: 'ExternalSystem',
      label: 'External system',
      help: 'A software system outside the scope of the model that yours depends on or talks to, such as a payment service.',
      look: look('rounded', {
        fill: '#dee2e6',
        border: '#868e96',
        subtitle: 'Tag',
        width: 200,
        height: 80,
      }),
      attributes: [
        long('Description'),
        text('Provider', { help: 'Who runs it.' }),
        formula(
          'Tag',
          "'[External system]'",
          'text',
          'The kind, shown under the name.',
        ),
      ],
      constraints: [connected('External system')],
    },
    boundary(
      'SystemBoundary',
      'System boundary',
      'The edge of one software system on a container diagram. Place its containers inside it.',
      'containers',
    ),
    {
      key: 'Container',
      label: 'Container',
      help: 'Something that runs or stores data on its own inside a software system: a web application, a mobile app, an API, a database, a queue or a background job.',
      look: look('rounded', {
        fill: '#d0ebff',
        border: '#1c7ed6',
        subtitle: 'Tag',
        width: 230,
        height: 80,
      }),
      attributes: [
        long('Description'),
        choice('Kind', [
          'Web application',
          'Mobile app',
          'Desktop app',
          'API',
          'Database',
          'Message queue',
          'File store',
          'Background job',
        ]),
        text('Technology', {
          help: 'What it is built with, such as "TypeScript, single-page app" or "relational database".',
        }),
        tag("(Kind ?? 'Container')"),
      ],
      constraints: [
        {
          id: 'k_container_technology',
          formula: '!isEmpty(Technology)',
          message:
            "= 'Container \"' + Name + '\" does not say what it is built with: fill in Technology.'",
        },
      ],
    },
    boundary(
      'ContainerBoundary',
      'Container boundary',
      'The edge of one container on a component diagram. Place its components inside it.',
      'components',
    ),
    {
      key: 'Component',
      label: 'Component',
      help: 'A group of related code inside a container, behind a clear interface, such as a booking controller.',
      look: look('rounded', {
        fill: '#e7f5ff',
        border: '#4dabf7',
        subtitle: 'Tag',
        width: 190,
        height: 76,
      }),
      attributes: [long('Description'), text('Technology'), tag("'Component'")],
    },
  ],
  relations: [
    {
      key: 'Uses',
      label: 'Uses',
      help: 'One element uses another: a person uses a system, a container calls an API or reads a database. Say what for, and how.',
      from: [
        'Person',
        'SoftwareSystem',
        'ExternalSystem',
        'Container',
        'Component',
      ],
      to: [
        'Person',
        'SoftwareSystem',
        'ExternalSystem',
        'Container',
        'Component',
      ],
      attributes: [
        text('Description', {
          help: 'What the relationship is for, such as "Makes bookings".',
        }),
        text('Technology', {
          help: 'How it talks, such as "JSON over HTTPS".',
        }),
        formula(
          'Label',
          "(Description ?? '') + (isEmpty(Technology) ? '' : ' [' + Technology + ']')",
          'text',
          'The description and the technology, shown on the line.',
        ),
      ],
      constraints: [
        {
          id: 'k_uses_description',
          formula: '!isEmpty(Description)',
          message:
            "= 'The relationship from \"' + from.Name + '\" to \"' + to.Name + '\" has no description: say what it is for.'",
        },
      ],
      look: line('#495057', { style: 'dashed', label: 'Label' }),
    },
  ],
  modelTypes: [
    {
      key: 'Context',
      label: 'System context',
      help: 'One software system in its setting: the people who use it and the other systems it works with.',
      classes: PEOPLE_AND_SYSTEMS,
      relations: ['Uses'],
    },
    {
      key: 'Containers',
      label: 'Containers',
      help: 'The containers inside one software system, inside its boundary, with the people and systems around it.',
      classes: [...PEOPLE_AND_SYSTEMS, 'SystemBoundary', 'Container'],
      relations: ['Uses'],
      containers: { SystemBoundary: ['Container'] },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Owner'),
        formula(
          'Containers',
          "count(objects('Container'))",
          'number',
          'How many containers the diagram shows.',
        ),
      ],
    },
    {
      key: 'Components',
      label: 'Components',
      help: 'The components inside one container, inside its boundary, with the containers and systems they talk to.',
      classes: [
        ...PEOPLE_AND_SYSTEMS,
        'Container',
        'ContainerBoundary',
        'Component',
      ],
      relations: ['Uses'],
      containers: { ContainerBoundary: ['Component'] },
    },
  ],
  sample: {
    file: 'ticket-booking.mkmodel.json',
    id: 'mdl_ticketbooking',
    name: 'Ticket booking: containers',
    modelType: 'Containers',
    attributes: {
      Title: 'Ticket booking: containers',
      Owner: 'Head of digital',
    },
    // The email service reaches the customer without a description, on purpose.
    intendedWarnings: 1,
    elements: [
      e('p_staff', 'Person', 170, 20, {
        Name: 'Box office staff',
        Location: 'Internal',
        Description: 'Sells tickets at the desk and by phone.',
      }),
      e('p_customer', 'Person', 630, 20, {
        Name: 'Theatre visitor',
        Location: 'External',
        Description: 'Books tickets online.',
      }),
      e(
        'b_ticketing',
        'SystemBoundary',
        40,
        170,
        {
          Name: 'Ticketing system',
          Description:
            'Sells tickets for the shows of a regional theatre group.',
        },
        { w: 960, h: 380 },
      ),
      e(
        'c_boxoffice',
        'Container',
        100,
        200,
        {
          Name: 'Box office app',
          Kind: 'Web application',
          Technology: 'Server-rendered',
        },
        { parent: 'b_ticketing' },
      ),
      e(
        'c_shop',
        'Container',
        550,
        200,
        {
          Name: 'Web shop',
          Kind: 'Web application',
          Technology: 'Single-page app',
        },
        { parent: 'b_ticketing' },
      ),
      e(
        'c_api',
        'Container',
        330,
        330,
        {
          Name: 'Booking API',
          Kind: 'API',
          Technology: 'Java, REST',
        },
        { parent: 'b_ticketing' },
      ),
      e(
        'c_worker',
        'Container',
        700,
        450,
        {
          Name: 'Email worker',
          Kind: 'Background job',
          Technology: 'Python',
        },
        { parent: 'b_ticketing' },
      ),
      e(
        'c_db',
        'Container',
        330,
        450,
        {
          Name: 'Booking database',
          Kind: 'Database',
          Technology: 'Relational database',
        },
        { parent: 'b_ticketing' },
      ),
      e('x_payments', 'ExternalSystem', 1080, 330, {
        Name: 'Payment provider',
        Description: 'Takes card payments.',
      }),
      e('x_email', 'ExternalSystem', 1080, 40, {
        Name: 'Email service',
        Description: 'Sends emails on behalf of the theatre.',
      }),
    ],
    connectors: [
      uses('p_staff', 'c_boxoffice', 'Sells tickets', 'HTTPS'),
      uses('p_customer', 'c_shop', 'Books tickets', 'HTTPS'),
      uses('c_boxoffice', 'c_api', 'Makes bookings', 'JSON/HTTPS'),
      uses('c_shop', 'c_api', 'Finds shows and books', 'JSON/HTTPS'),
      uses('c_api', 'c_db', 'Reads and writes', 'SQL'),
      uses('c_api', 'x_payments', 'Takes payments', 'HTTPS'),
      uses('c_api', 'c_worker', 'Queues confirmations', 'Message queue'),
      uses('c_worker', 'x_email', 'Sends emails', 'SMTP'),
      uses('x_email', 'p_customer'),
    ],
  },
};
