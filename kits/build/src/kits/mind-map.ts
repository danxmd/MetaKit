import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
  line,
  long,
  look,
  text,
  type KitSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Mind maps and concept maps. A mind map grows from one central topic into topics and ideas;
 * each branch takes the colour of its topic. A concept map links concepts with labelled links
 * that read as sentences.
 */

const COLOURS = ['Blue', 'Green', 'Orange', 'Purple', 'Red', 'Teal'];
const STRONG: Record<string, string> = {
  Blue: '#a5d8ff',
  Green: '#b2f2bb',
  Orange: '#ffd8a8',
  Purple: '#d0bfff',
  Red: '#ffc9c9',
  Teal: '#96f2d7',
};
const LIGHT: Record<string, string> = {
  Blue: '#e7f5ff',
  Green: '#ebfbee',
  Orange: '#fff4e6',
  Purple: '#f3f0ff',
  Red: '#fff5f5',
  Teal: '#e6fcf5',
};
const EDGE: Record<string, string> = {
  Blue: '#1c7ed6',
  Green: '#2f9e44',
  Orange: '#f08c00',
  Purple: '#7048e8',
  Red: '#e03131',
  Teal: '#0c8599',
};
const by = (key: string, values: Record<string, string>, fallback: string) => ({
  by: key,
  values,
  fallback,
});

/** The colour of the branch this object hangs from, through its first incoming branch line. */
const inherited = "IFERROR(incoming('BranchesTo')[0].BranchColour, null)";

const attached = (what: string) => ({
  id: `k_${what.toLowerCase()}_attached`,
  formula: "count(incoming('BranchesTo')) > 0",
  message: `= '${what} "' + Name + '" is not attached to the map: connect it to its topic with "Branch".'`,
});

const e = (
  id: string,
  cls: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
  extra: Partial<SampleElement> = {},
): SampleElement => ({ id, class: cls, x, y, attributes, ...extra });
const branch = (from: string, to: string): SampleConnector => ({
  relation: 'BranchesTo',
  from,
  to,
});

/** A topic and its ideas, the ideas in a column on the outer side. */
function topic(
  id: string,
  name: string,
  colour: string,
  x: number,
  y: number,
  ideaX: number,
  ideas: string[],
): { elements: SampleElement[]; connectors: SampleConnector[] } {
  return {
    elements: [
      e(id, 'Topic', x, y, { Name: name, Colour: colour }),
      ...ideas.map((idea, i) =>
        e(`${id}_${i + 1}`, 'Idea', ideaX, y - 70 + i * 70, { Name: idea }),
      ),
    ],
    connectors: [
      branch('central', id),
      ...ideas.map((_, i) => branch(id, `${id}_${i + 1}`)),
    ],
  };
}

const venue = topic('venue', 'Venue', 'Blue', 320, 140, 40, [
  'Country house',
  'City hotel',
  'Room for 40 people',
]);
const agenda = topic('agenda', 'Agenda', 'Green', 860, 140, 1120, [
  'Plans for next year',
  'Team games',
  'Awards dinner',
]);
const travel = topic('travel', 'Travel', 'Orange', 320, 480, 40, [
  'Shared coaches',
  'Car sharing',
]);
const budget = topic('budget', 'Budget', 'Purple', 860, 480, 1120, [
  'Up to 400 per person',
  'Ask for a group rate',
]);

export const mindMap: KitSpec = {
  folder: 'mind-map',
  id: 'kit_mindmap' as KitId,
  name: 'Mind map and concept map',
  catalog: { keys: ['Note'] },
  classes: [
    {
      key: 'CentralTopic',
      label: 'Central topic',
      help: 'The subject of the mind map, in the middle. Everything else branches from it.',
      look: look('circle', {
        fill: '#ffec99',
        border: '#f08c00',
        borderWidth: 2.5,
        width: 220,
        height: 110,
      }),
      attributes: [
        long('Description'),
        formula(
          'Branches',
          "count(outgoing('BranchesTo'))",
          'number',
          'How many topics branch from it.',
        ),
      ],
    },
    {
      key: 'Topic',
      label: 'Topic',
      help: 'A main branch of the map. Its colour is passed on to the topics and ideas that hang from it.',
      look: look('pill', {
        fill: by('BranchColour', STRONG, '#e9ecef'),
        border: by('BranchColour', EDGE, '#868e96'),
        borderWidth: 2,
        width: 160,
        height: 50,
      }),
      attributes: [
        choice('Colour', COLOURS, {
          help: 'The colour of the branch. Leave it empty on a sub-topic to take the colour of the topic above.',
        }),
        long('Description'),
        formula(
          'BranchColour',
          `Colour ?? ${inherited}`,
          'text',
          'Its own colour, or the colour of the topic it hangs from.',
          { label: 'Branch colour' },
        ),
        formula(
          'Ideas',
          "count(outgoing('BranchesTo'))",
          'number',
          'How many topics and ideas hang from it.',
        ),
      ],
      constraints: [attached('Topic')],
    },
    {
      key: 'Idea',
      label: 'Idea',
      help: 'A thought on a branch. It takes the colour of its topic.',
      look: look('rounded', {
        fill: by('BranchColour', LIGHT, '#f8f9fa'),
        border: by('BranchColour', EDGE, '#868e96'),
        width: 170,
        height: 44,
      }),
      attributes: [
        long('Description'),
        formula(
          'BranchColour',
          inherited,
          'text',
          'The colour of the topic it hangs from.',
          { label: 'Branch colour' },
        ),
      ],
      constraints: [attached('Idea')],
    },
    {
      key: 'Concept',
      label: 'Concept',
      help: 'An idea in a concept map, linked to other concepts by labelled links.',
      look: look('rounded', {
        fill: by('Colour', STRONG, '#e7f5ff'),
        border: by('Colour', EDGE, '#1c7ed6'),
        width: 170,
        height: 60,
      }),
      attributes: [choice('Colour', COLOURS), long('Description')],
      constraints: [
        {
          id: 'k_concept_linked',
          formula:
            "count(outgoing('LinksTo')) + count(incoming('LinksTo')) > 0",
          message: "= 'Concept \"' + Name + '\" is not linked to any other.'",
        },
      ],
    },
  ],
  relations: [
    {
      key: 'BranchesTo',
      label: 'Branch',
      help: 'The topic or idea hangs from the central topic or topic it starts at.',
      from: ['CentralTopic', 'Topic'],
      to: ['Topic', 'Idea'],
      look: {
        ...line('#868e96', { end: 'none' }),
        width: 2,
        routing: 'curved',
      },
    },
    {
      key: 'LinksTo',
      label: 'Link',
      help: 'A labelled link that reads as a sentence from one end to the other, such as "Budget limits Venue".',
      from: ['CentralTopic', 'Topic', 'Idea', 'Concept'],
      to: ['CentralTopic', 'Topic', 'Idea', 'Concept'],
      attributes: [
        text('Label', { help: 'The words on the link, such as "limits".' }),
      ],
      constraints: [
        {
          id: 'k_link_label',
          formula: '!isEmpty(Label)',
          message:
            "= 'The link from \"' + from.Name + '\" to \"' + to.Name + '\" has no label: say how they are related.'",
        },
      ],
      look: {
        ...line('#495057', { style: 'dashed', label: 'Label' }),
        routing: 'curved',
      },
    },
    {
      key: 'Annotates',
      label: 'Annotates',
      help: 'The note explains the object it points to.',
      from: ['Note'],
      to: ['CentralTopic', 'Topic', 'Idea', 'Concept'],
      look: line('#adb5bd', { style: 'dotted', end: 'none' }),
    },
  ],
  modelTypes: [
    {
      key: 'MindMap',
      label: 'Mind map',
      help: 'One central topic with topics and ideas branching from it, coloured by branch.',
      classes: ['CentralTopic', 'Topic', 'Idea', 'Note'],
      relations: ['BranchesTo', 'LinksTo', 'Annotates'],
      cardinalities: [{ kind: 'count', class: 'CentralTopic', min: 1, max: 1 }],
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Author'),
        formula(
          'Topics',
          "count(objects('Topic'))",
          'number',
          'How many topics the map has.',
        ),
        formula(
          'Ideas',
          "count(objects('Idea'))",
          'number',
          'How many ideas the map has.',
        ),
      ],
    },
    {
      key: 'ConceptMap',
      label: 'Concept map',
      help: 'Concepts joined by labelled links that read as sentences.',
      classes: ['Concept', 'Note'],
      relations: ['LinksTo', 'Annotates'],
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('FocusQuestion', {
          label: 'Focus question',
          help: 'The question the map answers.',
        }),
      ],
    },
  ],
  sample: {
    file: 'team-offsite.mkmodel.json',
    id: 'mdl_teamoffsite',
    name: 'Team offsite',
    modelType: 'MindMap',
    attributes: { Title: 'Team offsite', Author: 'Office manager' },
    intendedWarnings: 0,
    elements: [
      e('central', 'CentralTopic', 560, 285, {
        Name: 'Team offsite in June',
      }),
      ...venue.elements,
      ...agenda.elements,
      ...travel.elements,
      ...budget.elements,
      e(
        'note_dates',
        'Note',
        575,
        60,
        {
          Name: 'Dates',
          Text: 'First or second week of June; ask the teams before booking.',
        },
        { w: 190, h: 90 },
      ),
    ],
    connectors: [
      ...venue.connectors,
      ...agenda.connectors,
      ...travel.connectors,
      ...budget.connectors,
      {
        relation: 'LinksTo',
        from: 'budget',
        to: 'travel',
        attributes: { Label: 'also pays for' },
      },
      { relation: 'Annotates', from: 'note_dates', to: 'central' },
    ],
  },
};
