import type { KitId } from '@metakit-app/core';
import {
  choice,
  date,
  formula,
  int,
  line,
  long,
  look,
  table,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Requirements and user stories: epics hold features, features hold user stories written as
 * "As a … I want … so that …" with acceptance criteria. Stories, features and epics trace to the
 * goals they serve, tests verify them, and requirements that apply across stories constrain them.
 */

const MOSCOW = ['Must have', 'Should have', 'Could have', "Won't have"];
const STORY_STATUS = ['Backlog', 'Ready', 'In progress', 'Done'];

const STORY_FILL = {
  by: 'Status',
  values: {
    Backlog: '#f8f9fa',
    Ready: '#e7f5ff',
    'In progress': '#fff3bf',
    Done: '#d3f9d8',
  },
  fallback: '#f8f9fa',
};

/** Stories and points of the parts inside an epic or feature, and the share of points done. */
const rollUp = (what: string, count: string, points: string, done: string) => [
  formula(
    'Stories',
    count,
    'number',
    `How many user stories the ${what} holds.`,
  ),
  formula(
    'Points',
    points,
    'number',
    `The estimates of the user stories in the ${what} added up, in story points.`,
  ),
  formula(
    'PointsDone',
    done,
    'number',
    'The points of the stories that are done.',
  ),
  formula(
    'Progress',
    'IFERROR(round(PointsDone / Points * 100, 0), null)',
    'number',
    'The share of the points that is done, in percent.',
    { label: 'Progress (%)' },
  ),
  formula(
    'Heading',
    "Name + ' · ' + Stories + (Stories == 1 ? ' story, ' : ' stories, ') + Points + ' points'",
    'text',
    'The name with the number of stories and points, shown as the title.',
  ),
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

type Criteria = [string, string, string][];
const story = (
  id: string,
  feature: string,
  x: number,
  y: number,
  values: Record<string, string | number>,
  criteria: Criteria = [],
): SampleElement =>
  e(
    id,
    'UserStory',
    x,
    y,
    {
      ...values,
      ...(criteria.length > 0
        ? {
            AcceptanceCriteria: criteria.map(([given, when, then]) => ({
              given,
              when,
              then,
            })),
          }
        : {}),
    },
    { parent: feature },
  );

export const requirementsStories: KitSpec = {
  folder: 'requirements-stories',
  id: 'kit_requirements' as KitId,
  name: 'Requirements and user stories',
  catalog: { keys: ['Goal', 'Requirement'], generic: ['DependsOn'] },
  classes: [
    {
      key: 'Epic',
      label: 'Epic',
      help: 'A large piece of work that delivers value in several steps. Place its features inside it.',
      look: look('container', {
        fill: '#f3f0ff',
        border: '#7048e8',
        borderWidth: 2,
        title: 'Heading',
        width: 880,
        height: 260,
      }),
      attributes: [
        long('Description'),
        text('Owner'),
        choice('Priority', MOSCOW, { label: 'Priority (MoSCoW)' }),
        ...rollUp(
          'epic',
          'sum(children().Stories)',
          'sum(children().Points)',
          'sum(children().PointsDone)',
        ),
      ],
    },
    {
      key: 'Feature',
      label: 'Feature',
      help: 'A function of the product that users can see. Place its user stories inside it.',
      look: look('container', {
        fill: '#e7f5ff',
        border: '#1c7ed6',
        title: 'Heading',
        width: 410,
        height: 190,
      }),
      attributes: [
        long('Description'),
        choice('Priority', MOSCOW, { label: 'Priority (MoSCoW)' }),
        text('Release'),
        ...rollUp(
          'feature',
          'count(children())',
          'sum(children().Estimate)',
          'sum(children().PointsDone)',
        ),
      ],
      constraints: [
        {
          id: 'k_feature_epic',
          formula: 'parent != null',
          message:
            "= 'Feature \"' + Name + '\" belongs to no epic: place it inside one.'",
        },
      ],
    },
    {
      key: 'UserStory',
      label: 'User story',
      help: 'A need written from the point of view of a user: as a …, I want …, so that …, with the criteria that say when it is done.',
      look: look('header-box', {
        fill: STORY_FILL,
        border: '#1c7ed6',
        icon: 'person',
        fields: ['Priority', 'Estimate', 'Criteria'],
        width: 185,
      }),
      attributes: [
        text('AsA', {
          label: 'As a',
          help: 'Who wants it, such as "patient".',
        }),
        long('IWant', { label: 'I want', help: 'What they want to do.' }),
        long('SoThat', { label: 'so that', help: 'Why they want it.' }),
        table(
          'AcceptanceCriteria',
          [
            { key: 'Given', type: 'text' },
            { key: 'When', type: 'text' },
            { key: 'Then', type: 'text' },
          ],
          {
            help: 'One row per criterion: the situation, what happens, and the result that must follow.',
          },
        ),
        choice('Priority', MOSCOW, { label: 'Priority (MoSCoW)' }),
        int('Estimate', {
          min: 0,
          label: 'Estimate (points)',
          help: 'The size in story points.',
        }),
        choice('Status', STORY_STATUS),
        text('Sprint'),
        formula(
          'Criteria',
          'len(AcceptanceCriteria)',
          'number',
          'How many acceptance criteria it has.',
        ),
        formula(
          'PointsDone',
          "Status == 'Done' ? (Estimate ?? 0) : 0",
          'number',
          'The estimate when the story is done, otherwise 0.',
        ),
        formula(
          'StoryText',
          "'As ' + (AsA ?? '…') + ', I want ' + (IWant ?? '…') + ' so that ' + (SoThat ?? '…') + '.'",
          'text',
          'The story as one sentence.',
          { label: 'Story' },
        ),
        formula(
          'Tests',
          "count(incoming('Verifies'))",
          'number',
          'How many tests verify it.',
        ),
      ],
      constraints: [
        {
          id: 'k_story_criteria',
          formula: 'Criteria > 0',
          message:
            "= 'User story \"' + Name + '\" has no acceptance criteria: add at least one row, so everyone knows when it is done.'",
        },
        {
          id: 'k_story_form',
          formula: '!isEmpty(AsA) && !isEmpty(IWant)',
          message:
            '= \'User story "\' + Name + \'" does not say who wants it and what they want: fill in "As a" and "I want".\'',
        },
        {
          id: 'k_story_estimate',
          formula: "Status == 'Backlog' || Status == null || Estimate != null",
          message:
            "= 'User story \"' + Name + '\" is ' + Status + ' but has no estimate.'",
        },
      ],
    },
    {
      key: 'TestCase',
      label: 'Test',
      help: 'A test that shows a story, feature or requirement works, with the result of its last run.',
      look: look('rounded', {
        fill: {
          by: 'Status',
          values: {
            'Not run': '#f8f9fa',
            Passed: '#d3f9d8',
            Failed: '#ffc9c9',
          },
          fallback: '#f8f9fa',
        },
        border: '#2f9e44',
        icon: 'check',
        subtitle: 'Status',
        width: 170,
      }),
      attributes: [
        long('Steps'),
        choice('Type', ['Manual', 'Automated']),
        choice('Status', ['Not run', 'Passed', 'Failed']),
        date('LastRun'),
      ],
      constraints: [
        {
          id: 'k_test_target',
          formula: "count(outgoing('Verifies')) > 0",
          message:
            "= 'Test \"' + Name + '\" verifies nothing: connect it to a story, feature or requirement.'",
        },
      ],
    },
  ],
  amend: {
    Goal: {
      attributes: [
        formula(
          'Contributions',
          "count(incoming('ContributesTo'))",
          'number',
          'How many epics, features, stories and requirements contribute to it.',
        ),
      ],
      constraints: [
        {
          id: 'k_goal_traced',
          formula: 'Contributions > 0',
          message:
            "= 'Nothing in the backlog contributes to the goal \"' + Name + '\".'",
        },
      ],
    },
    Requirement: {
      help: 'A need that applies across stories, such as how fast or how secure the product must be, with its priority and how it will be accepted.',
      attributes: [choice('Priority', MOSCOW, { label: 'Priority (MoSCoW)' })],
    },
  },
  relations: [
    {
      key: 'ContributesTo',
      label: 'Contributes to',
      help: 'The epic, feature, story or requirement helps to reach the goal.',
      from: ['Epic', 'Feature', 'UserStory', 'Requirement'],
      to: ['Goal'],
      look: line('#2f9e44'),
    },
    {
      key: 'Verifies',
      label: 'Verifies',
      help: 'The test shows the story, feature or requirement works.',
      from: ['TestCase'],
      to: ['UserStory', 'Feature', 'Requirement'],
      look: line('#2f9e44', { style: 'dashed', end: 'open-arrow' }),
    },
    {
      key: 'Constrains',
      label: 'Constrains',
      help: 'The requirement applies to the epic, feature or story.',
      from: ['Requirement'],
      to: ['Epic', 'Feature', 'UserStory'],
      look: line('#f08c00', { style: 'dotted' }),
    },
  ],
  amendRelations: {
    DependsOn: {
      replace: true,
      from: ['UserStory', 'Feature', 'Epic'],
      to: ['UserStory', 'Feature', 'Epic'],
    },
  },
  modelTypes: [
    {
      key: 'Backlog',
      label: 'Product backlog',
      help: 'Goals, epics holding features, features holding user stories, the requirements that apply across them and the tests that verify them.',
      views: [
        {
          key: 'StoryMap',
          label: 'Story map',
          classes: ['Epic', 'Feature', 'UserStory'],
          relations: ['DependsOn'],
        },
        {
          key: 'Traceability',
          label: 'Traceability',
          classes: [
            'Goal',
            'Epic',
            'Feature',
            'UserStory',
            'Requirement',
            'TestCase',
          ],
          relations: ['ContributesTo', 'Verifies', 'Constrains'],
        },
      ],
      containers: { Epic: ['Feature'], Feature: ['UserStory'] },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Product'),
        text('ProductOwner'),
        formula(
          'Stories',
          "count(objects('UserStory'))",
          'number',
          'How many user stories the backlog holds.',
        ),
        formula(
          'Points',
          "sum(objects('UserStory').Estimate)",
          'number',
          'The estimates of all user stories added up.',
        ),
        formula(
          'Progress',
          "IFERROR(round(sum(objects('UserStory').PointsDone) / Points * 100, 0), null)",
          'number',
          'The share of all points that is done, in percent.',
          { label: 'Progress (%)' },
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'UserStory',
      tabs: [
        {
          label: 'Story',
          items: [
            'Name',
            'AsA',
            { attribute: 'IWant', control: 'textarea' },
            { attribute: 'SoThat', control: 'textarea' },
            'StoryText',
          ],
        },
        {
          label: 'Acceptance',
          items: ['AcceptanceCriteria', 'Criteria', 'Tests'],
        },
        {
          label: 'Planning',
          items: [
            { attribute: 'Priority', control: 'segmented' },
            'Estimate',
            { attribute: 'Status', control: 'select' },
            'Sprint',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'appointment-booking.mkmodel.json',
    id: 'mdl_appointmentbooking',
    name: 'Online appointment booking',
    modelType: 'Backlog',
    attributes: {
      Title: 'Online appointment booking',
      Product: 'Patient web app',
      ProductOwner: 'Head of patient services',
    },
    // "Change an appointment" has no acceptance criteria yet, on purpose.
    intendedWarnings: 1,
    elements: [
      e(
        'goal_calls',
        'Goal',
        200,
        20,
        {
          Name: 'Fewer phone calls to reception',
          Horizon: 'Short term',
          Measure: 'Calls per week',
        },
        { w: 200, h: 90 },
      ),
      e(
        'goal_noshow',
        'Goal',
        1280,
        20,
        {
          Name: 'Fewer missed appointments',
          Horizon: 'Medium term',
          Measure: 'Share of appointments missed',
        },
        { w: 200, h: 90 },
      ),
      e('req_speed', 'Requirement', 760, 30, {
        Name: 'Pages load within two seconds',
        Type: 'Non-functional',
        Priority: 'Must have',
        AcceptanceCriteria: 'Measured on a mobile connection at busy times.',
      }),
      // Epic 1: booking.
      e(
        'epic_book',
        'Epic',
        20,
        150,
        {
          Name: 'Book an appointment',
          Owner: 'Head of patient services',
          Priority: 'Must have',
        },
        { w: 880, h: 260 },
      ),
      e(
        'f_slot',
        'Feature',
        40,
        200,
        { Name: 'Find a free slot', Priority: 'Must have', Release: '1.0' },
        { w: 410, h: 190, parent: 'epic_book' },
      ),
      e(
        'f_confirm',
        'Feature',
        470,
        200,
        { Name: 'Confirm the booking', Priority: 'Must have', Release: '1.0' },
        { w: 410, h: 190, parent: 'epic_book' },
      ),
      story(
        's_search',
        'f_slot',
        55,
        250,
        {
          Name: 'See free slots this week',
          AsA: 'patient',
          IWant: 'to see the free slots of my practice for the coming week',
          SoThat: 'I can pick a time without calling',
          Priority: 'Must have',
          Estimate: 5,
          Status: 'Done',
          Sprint: 'Sprint 1',
        },
        [
          [
            'I am signed in',
            'I open "Book"',
            'I see the free slots of the next seven days',
          ],
          [
            'no slot is free this week',
            'I open "Book"',
            'I am offered the first free slot after it',
          ],
        ],
      ),
      story(
        's_filter',
        'f_slot',
        250,
        250,
        {
          Name: 'Choose a dentist',
          AsA: 'patient',
          IWant: 'to see only the slots of the dentist I know',
          SoThat: 'I keep seeing the same person',
          Priority: 'Should have',
          Estimate: 3,
          Status: 'In progress',
          Sprint: 'Sprint 2',
        },
        [
          [
            'I chose a dentist',
            'the slots are shown',
            'only that dentist’s slots are listed',
          ],
        ],
      ),
      story(
        's_confirm',
        'f_confirm',
        485,
        250,
        {
          Name: 'Get a confirmation',
          AsA: 'patient',
          IWant: 'a confirmation by email and text message',
          SoThat: 'I know the booking worked',
          Priority: 'Must have',
          Estimate: 3,
          Status: 'Ready',
        },
        [
          [
            'I booked a slot',
            'the booking is saved',
            'I receive an email and a text message within one minute',
          ],
        ],
      ),
      story(
        's_deposit',
        'f_confirm',
        685,
        250,
        {
          Name: 'Pay a deposit',
          AsA: 'new patient',
          IWant: 'to pay a small deposit when I book',
          SoThat: 'my first appointment is held for me',
          Priority: 'Could have',
          Estimate: 8,
          Status: 'Backlog',
        },
        [
          [
            'I am a new patient',
            'I confirm a booking',
            'I am asked to pay the deposit',
          ],
        ],
      ),
      // Epic 2: managing appointments.
      e(
        'epic_manage',
        'Epic',
        940,
        150,
        {
          Name: 'Manage my appointments',
          Owner: 'Head of patient services',
          Priority: 'Should have',
        },
        { w: 880, h: 260 },
      ),
      e(
        'f_remind',
        'Feature',
        960,
        200,
        { Name: 'Reminders', Priority: 'Must have', Release: '1.1' },
        { w: 410, h: 190, parent: 'epic_manage' },
      ),
      e(
        'f_change',
        'Feature',
        1390,
        200,
        { Name: 'Change or cancel', Priority: 'Should have', Release: '1.1' },
        { w: 410, h: 190, parent: 'epic_manage' },
      ),
      story(
        's_remind',
        'f_remind',
        975,
        250,
        {
          Name: 'Reminder the day before',
          AsA: 'patient',
          IWant: 'a reminder the day before my appointment',
          SoThat: 'I do not forget it',
          Priority: 'Must have',
          Estimate: 3,
          Status: 'Ready',
        },
        [
          [
            'I have an appointment tomorrow',
            'it is 10 o’clock today',
            'I receive a text message reminder',
          ],
        ],
      ),
      story(
        's_calendar',
        'f_remind',
        1175,
        250,
        {
          Name: 'Add to my calendar',
          AsA: 'patient',
          IWant: 'to add the appointment to my calendar',
          SoThat: 'it shows next to my other plans',
          Priority: 'Could have',
          Estimate: 2,
          Status: 'Backlog',
        },
        [
          [
            'I have a booking',
            'I choose "Add to calendar"',
            'a calendar file with the time and place is downloaded',
          ],
        ],
      ),
      story('s_change', 'f_change', 1405, 250, {
        Name: 'Change an appointment',
        AsA: 'patient',
        IWant: 'to move my appointment to another free slot',
        SoThat: 'I do not have to cancel and book again',
        Priority: 'Should have',
        Estimate: 5,
        Status: 'Backlog',
      }),
      story(
        's_cancel',
        'f_change',
        1605,
        250,
        {
          Name: 'Cancel an appointment',
          AsA: 'patient',
          IWant: 'to cancel up to 24 hours before',
          SoThat: 'the slot goes to someone else',
          Priority: 'Must have',
          Estimate: 3,
          Status: 'Backlog',
        },
        [
          [
            'my appointment is more than 24 hours away',
            'I cancel it',
            'the slot is free again at once',
          ],
          [
            'my appointment is less than 24 hours away',
            'I try to cancel it',
            'I am asked to call the practice',
          ],
        ],
      ),
      // Tests below the stories.
      e('t_slots', 'TestCase', 55, 470, {
        Name: 'Free slots are listed',
        Type: 'Automated',
        Status: 'Passed',
        LastRun: '2027-03-12',
      }),
      e('t_dentist', 'TestCase', 250, 470, {
        Name: 'Filter by dentist',
        Type: 'Automated',
        Status: 'Failed',
        LastRun: '2027-03-12',
      }),
      e('t_confirm', 'TestCase', 485, 470, {
        Name: 'Confirmation arrives',
        Type: 'Manual',
        Status: 'Not run',
      }),
      e('t_speed', 'TestCase', 700, 470, {
        Name: 'Load test at peak',
        Type: 'Automated',
        Status: 'Not run',
      }),
      e('t_cancel', 'TestCase', 1605, 470, {
        Name: 'Late cancel is refused',
        Type: 'Manual',
        Status: 'Not run',
      }),
    ],
    connectors: [
      c('ContributesTo', 'epic_book', 'goal_calls'),
      c('ContributesTo', 'epic_manage', 'goal_noshow'),
      c('Constrains', 'req_speed', 'epic_book'),
      c('Verifies', 't_slots', 's_search'),
      c('Verifies', 't_dentist', 's_filter'),
      c('Verifies', 't_confirm', 's_confirm'),
      c('Verifies', 't_speed', 'req_speed'),
      c('Verifies', 't_cancel', 's_cancel'),
    ],
  },
};
