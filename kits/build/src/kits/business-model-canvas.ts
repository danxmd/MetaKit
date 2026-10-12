import type { KitId } from '@metakit-app/core';
import {
  choice,
  formula,
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
 * Business model canvas: the nine blocks as containers, items (sticky notes) inside them with
 * how well they are tested, amounts for revenue streams and costs, and labelled links between
 * items, such as a value proposition and the segment it serves.
 */

const BLOCKS = [
  'Key partners',
  'Key activities',
  'Key resources',
  'Value propositions',
  'Customer relationships',
  'Channels',
  'Customer segments',
  'Cost structure',
  'Revenue streams',
];

const QUESTIONS: Record<string, string> = {
  'Key partners': 'Who helps us, and what do they bring?',
  'Key activities': 'What must we do well to deliver the value?',
  'Key resources': 'What do we need to have to deliver the value?',
  'Value propositions':
    'What value do we bring, and which problems do we solve?',
  'Customer relationships': 'How do we win, keep and grow customers?',
  Channels: 'How do we reach and serve our customers?',
  'Customer segments': 'For whom do we create value?',
  'Cost structure': 'What are the main costs?',
  'Revenue streams': 'For what do customers pay, and how?',
};

const QUESTION_FORMULA = BLOCKS.reduceRight(
  (rest, b) => `Block == '${b}' ? '${QUESTIONS[b]}' : (${rest})`,
  'null',
);

const BLOCK_FILL = (() => {
  const tone: Record<string, string> = {
    'Key partners': '#e7f5ff',
    'Key activities': '#e7f5ff',
    'Key resources': '#e7f5ff',
    'Value propositions': '#fff9db',
    'Customer relationships': '#ebfbee',
    Channels: '#ebfbee',
    'Customer segments': '#ebfbee',
    'Cost structure': '#fff5f5',
    'Revenue streams': '#f3f0ff',
  };
  // See-through, so links between items in different blocks stay visible.
  return {
    by: 'Block',
    values: Object.fromEntries(
      Object.entries(tone).map(([k, v]) => [k, `${v}66`]),
    ),
    fallback: '#f8f9fa66',
  };
})();

const linkedTo = (block: string, what: string) => ({
  id: `k_item_${block.toLowerCase().replace(/ /g, '')}`,
  formula: `Block != '${block}' || count(outgoing('Links')) + count(incoming('Links')) > 0`,
  message: `= '${what} "' + Name + '" is not linked to any other item.'`,
});

// The sample ------------------------------------------------------------------------------------

const COL = 250;
const block = (
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
): SampleElement => ({
  id,
  class: 'CanvasBlock',
  x,
  y,
  w,
  h,
  attributes: { Name: name, Block: name },
});
const item = (
  id: string,
  parent: string,
  x: number,
  y: number,
  attributes: SampleElement['attributes'],
): SampleElement => ({ id, class: 'CanvasItem', x, y, parent, attributes });
const links = (from: string, to: string, label?: string): SampleConnector => ({
  relation: 'Links',
  from,
  to,
  ...(label ? { attributes: { Label: label } } : {}),
});

/** Items stacked in a block that starts at (x, y). */
const stack = (
  parent: string,
  x: number,
  y: number,
  items: [string, SampleElement['attributes']][],
) =>
  items.map(([id, attributes], i) =>
    item(id, parent, x + 45, y + 44 + i * 68, attributes),
  );
/** Items side by side in a wide block that starts at (x, y). */
const row = (
  parent: string,
  x: number,
  y: number,
  items: [string, SampleElement['attributes']][],
) =>
  items.map(([id, attributes], i) =>
    item(id, parent, x + 20 + i * 160, y + 50, attributes),
  );

const X = (col: number) => 40 + col * COL;

export const businessModelCanvas: KitSpec = {
  folder: 'business-model-canvas',
  id: 'kit_bmcanvas' as KitId,
  name: 'Business model canvas',
  catalog: { keys: [] },
  classes: [
    {
      key: 'CanvasBlock',
      label: 'Canvas block',
      help: 'One of the nine blocks of the canvas, such as Value propositions. Place its items inside it.',
      kind: 'container',
      look: look('container', {
        fill: BLOCK_FILL,
        border: '#495057',
        title: 'Heading',
        width: 240,
        height: 480,
      }),
      attributes: [
        choice('Block', BLOCKS, { required: true }),
        formula(
          'Question',
          QUESTION_FORMULA,
          'text',
          'The question the block answers.',
        ),
        formula(
          'Items',
          'count(children())',
          'number',
          'How many items sit inside.',
        ),
        formula(
          'Total',
          'sum(children().AnnualAmount)',
          'number',
          'The annual amounts of the items inside added up.',
        ),
        formula(
          'Heading',
          "Name + (Total > 0 ? ', ' + Total + ' a year' : '')",
          'text',
          'The name, and the total for blocks with amounts, shown as the heading.',
        ),
      ],
    },
    {
      key: 'CanvasItem',
      label: 'Canvas item',
      help: 'A note in a block: a partner, an activity, a segment, a cost and so on. Say how well it is tested, and give revenue streams and costs an annual amount.',
      look: look('box', {
        fill: {
          by: 'Evidence',
          values: {
            Assumption: '#fff3bf',
            Tested: '#d0ebff',
            Proven: '#d3f9d8',
          },
          fallback: '#fff3bf',
        },
        border: '#f08c00',
        subtitle: 'Note',
        width: 150,
        height: 56,
      }),
      attributes: [
        long('Details'),
        choice('Evidence', ['Assumption', 'Tested', 'Proven'], {
          default: 'Assumption',
          help: 'Assumption: not checked yet. Tested: an experiment supports it. Proven: it works in the market.',
        }),
        num('AnnualAmount', {
          min: 0,
          help: 'For revenue streams and costs: the amount per year, in your currency.',
        }),
        formula(
          'Block',
          'parent ? parent.Block : null',
          'text',
          'The block it sits in.',
        ),
        formula(
          'Revenue',
          "Block == 'Revenue streams' ? AnnualAmount : null",
          'number',
          'The annual amount when it is a revenue stream.',
        ),
        formula(
          'Cost',
          "Block == 'Cost structure' ? AnnualAmount : null",
          'number',
          'The annual amount when it is a cost.',
        ),
        formula(
          'Note',
          "AnnualAmount == null ? (Evidence ?? '') : AnnualAmount + ' a year'",
          'text',
          'The annual amount, or how well it is tested, shown on the diagram.',
        ),
      ],
      constraints: [
        {
          id: 'k_item_block',
          formula: 'parent != null',
          message: "= 'Item \"' + Name + '\" is not inside any block.'",
        },
        {
          id: 'k_item_amount',
          formula:
            "AnnualAmount == null || Block == 'Revenue streams' || Block == 'Cost structure'",
          message:
            "= 'Item \"' + Name + '\" has an annual amount but is not a revenue stream or a cost.'",
        },
        linkedTo('Value propositions', 'Value proposition'),
        linkedTo('Customer segments', 'Customer segment'),
      ],
    },
  ],
  relations: [
    {
      key: 'Links',
      label: 'Links to',
      help: 'Two items belong together, such as a value proposition and the segment it is for. Say how on the line.',
      from: ['CanvasItem'],
      to: ['CanvasItem'],
      attributes: [text('Label')],
      look: line('#1c7ed6', { label: 'Label' }),
    },
  ],
  modelTypes: [
    {
      key: 'Canvas',
      label: 'Business model canvas',
      help: 'The nine blocks of a business model with their items, and the links between them.',
      cardinalities: [{ kind: 'count', class: 'CanvasBlock', max: 9 }],
      containers: { CanvasBlock: ['CanvasItem'] },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        text('Version'),
        formula(
          'TotalRevenue',
          "sum(objects('CanvasItem').Revenue)",
          'number',
          'The annual amounts of all revenue streams.',
        ),
        formula(
          'TotalCost',
          "sum(objects('CanvasItem').Cost)",
          'number',
          'The annual amounts of all costs.',
        ),
        formula(
          'Margin',
          'TotalRevenue - TotalCost',
          'number',
          'Total revenue minus total cost, per year.',
        ),
      ],
    },
  ],
  panels: [
    {
      class: 'CanvasBlock',
      tabs: [
        {
          label: 'Block',
          items: [
            'Name',
            { attribute: 'Block', control: 'select' },
            'Question',
            'Items',
            'Total',
          ],
        },
      ],
    },
    {
      class: 'CanvasItem',
      tabs: [
        {
          label: 'Item',
          items: [
            'Name',
            'Block',
            { attribute: 'Evidence', control: 'segmented' },
            { attribute: 'Details', control: 'textarea' },
            'AnnualAmount',
          ],
        },
      ],
      showRelations: true,
    },
  ],
  sample: {
    file: 'bike-repair.mkmodel.json',
    id: 'mdl_bikerepair',
    name: 'Bike repair subscription',
    modelType: 'Canvas',
    attributes: {
      Title: 'Bike repair subscription',
      Organisation: 'A city bike service',
      Version: 'Spring 2027',
    },
    // The segment "Students" is not linked to any other item, on purpose.
    intendedWarnings: 1,
    elements: [
      block('b_partners', 'Key partners', X(0), 40, 240, 480),
      block('b_activities', 'Key activities', X(1), 40, 240, 235),
      block('b_resources', 'Key resources', X(1), 285, 240, 235),
      block('b_values', 'Value propositions', X(2), 40, 240, 480),
      block('b_relationships', 'Customer relationships', X(3), 40, 240, 235),
      block('b_channels', 'Channels', X(3), 285, 240, 235),
      block('b_segments', 'Customer segments', X(4), 40, 240, 480),
      block('b_cost', 'Cost structure', X(0), 540, 615, 150),
      block('b_revenue', 'Revenue streams', X(0) + 625, 540, 615, 150),
      ...stack('b_partners', X(0), 40, [
        ['p_parts', { Name: 'Parts wholesaler', Evidence: 'Proven' }],
        ['p_employers', { Name: 'Large employers', Evidence: 'Tested' }],
        ['p_insurers', { Name: 'Bike insurers', Evidence: 'Assumption' }],
      ]),
      ...stack('b_activities', X(1), 40, [
        ['a_repair', { Name: 'Repairs at the bike', Evidence: 'Proven' }],
        ['a_routes', { Name: 'Planning van routes', Evidence: 'Tested' }],
      ]),
      ...stack('b_resources', X(1), 285, [
        ['r_vans', { Name: 'Repair vans', Evidence: 'Proven' }],
        ['r_mechanics', { Name: 'Trained mechanics', Evidence: 'Proven' }],
      ]),
      ...stack('b_values', X(2), 40, [
        [
          'v_fixed',
          { Name: 'Bike fixed where it is parked', Evidence: 'Proven' },
        ],
        ['v_price', { Name: 'One price a month', Evidence: 'Tested' }],
        ['v_fleet', { Name: 'Fleet always ready', Evidence: 'Assumption' }],
      ]),
      ...stack('b_relationships', X(3), 40, [
        ['rel_self', { Name: 'Booking in the app', Evidence: 'Proven' }],
        [
          'rel_named',
          { Name: 'Named mechanic for companies', Evidence: 'Assumption' },
        ],
      ]),
      ...stack('b_channels', X(3), 285, [
        ['ch_app', { Name: 'App and website', Evidence: 'Proven' }],
        ['ch_schemes', { Name: 'Company bike schemes', Evidence: 'Tested' }],
      ]),
      ...stack('b_segments', X(4), 40, [
        ['s_commuters', { Name: 'Daily commuters', Evidence: 'Proven' }],
        ['s_companies', { Name: 'Companies with fleets', Evidence: 'Tested' }],
        ['s_students', { Name: 'Students', Evidence: 'Assumption' }],
      ]),
      ...row('b_cost', X(0), 540, [
        ['c_wages', { Name: 'Mechanics', AnnualAmount: 420000 }],
        ['c_vans', { Name: 'Vans and fuel', AnnualAmount: 120000 }],
        ['c_parts', { Name: 'Parts', AnnualAmount: 90000 }],
      ]),
      ...row('b_revenue', X(0) + 625, 540, [
        [
          'rev_subs',
          {
            Name: 'Monthly subscriptions',
            AnnualAmount: 600000,
            Evidence: 'Proven',
          },
        ],
        [
          'rev_contracts',
          {
            Name: 'Company contracts',
            AnnualAmount: 180000,
            Evidence: 'Tested',
          },
        ],
        [
          'rev_parts',
          { Name: 'Parts sold', AnnualAmount: 40000, Evidence: 'Proven' },
        ],
      ]),
    ],
    connectors: [
      links('v_fixed', 's_commuters'),
      links('v_price', 's_commuters'),
      links('v_fleet', 's_companies', 'needs a contract'),
      links('rel_named', 's_companies'),
      links('ch_schemes', 'p_employers'),
    ],
  },
};
