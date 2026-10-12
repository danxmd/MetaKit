import type { KitId, LookColour } from '@metakit-app/core';
import {
  choice,
  formula,
  line,
  look,
  scale,
  text,
  type ClassSpec,
  type KitSpec,
  type PanelSpec,
  type SampleConnector,
  type SampleElement,
} from '../define';

/**
 * Business capability map: capabilities on three levels, nested as containers, with their
 * maturity now and as a target and their strategic importance. Gap times importance gives the
 * heat that colours each capability; applications support the capabilities.
 */

const GREEN = '#2f9e44';

/** Opaque for the lowest level; see-through for the containers, so connectors stay visible. */
const heat = (alpha = ''): LookColour => ({
  by: 'Heat',
  values: {
    Hot: `#ffa8a8${alpha}`,
    Warm: `#ffd8a8${alpha}`,
    Mild: `#fff3bf${alpha}`,
    Fine: `#d3f9d8${alpha}`,
  },
  fallback: `#f8f9fa${alpha}`,
});

const insideConstraint = (level: string, parent: string) => ({
  id: `k_${level.toLowerCase().replace(/ /g, '')}_parent`,
  formula: 'parent != null',
  message: `= '${level} capability "' + Name + '" is not inside a ${parent} capability.'`,
});

const level = (
  key: string,
  label: string,
  help: string,
  extra: Partial<ClassSpec>,
): ClassSpec => ({
  key,
  label,
  help,
  extends: 'BusinessCapability',
  attributes: [],
  ...extra,
});

const panel = (cls: string): PanelSpec => ({
  class: cls,
  tabs: [
    {
      label: 'Capability',
      items: [
        'Name',
        { attribute: 'Description', control: 'textarea' },
        'Owner',
      ],
    },
    {
      label: 'Assessment',
      items: [
        'Maturity',
        'TargetMaturity',
        { attribute: 'StrategicImportance', control: 'segmented' },
        'Gap',
        'HeatScore',
        'Heat',
        'Applications',
      ],
    },
  ],
  showRelations: true,
});

// The sample: three level 1 capabilities, each with three level 2 and six level 3 capabilities.
type L3 = [id: string, name: string, now: number, target: number, imp: string];
const MAP: {
  id: string;
  name: string;
  children: { id: string; name: string; children: [L3, L3] }[];
}[] = [
  {
    id: 'customer',
    name: 'Customer',
    children: [
      {
        id: 'marketing',
        name: 'Marketing',
        children: [
          ['campaigns', 'Campaign management', 3, 3, 'Medium'],
          ['insight', 'Customer insight', 2, 4, 'High'],
        ],
      },
      {
        id: 'sales',
        name: 'Sales',
        children: [
          ['online', 'Online sales', 3, 5, 'High'],
          ['store', 'Store sales', 4, 4, 'Medium'],
        ],
      },
      {
        id: 'service',
        name: 'Service',
        children: [
          ['returns', 'Returns handling', 2, 3, 'Medium'],
          ['support', 'Customer support', 3, 4, 'Medium'],
        ],
      },
    ],
  },
  {
    id: 'products',
    name: 'Products and supply',
    children: [
      {
        id: 'range',
        name: 'Range planning',
        children: [
          ['assortment', 'Assortment planning', 3, 4, 'Medium'],
          ['pricing', 'Dynamic pricing', 1, 4, 'High'],
        ],
      },
      {
        id: 'supply',
        name: 'Supply chain',
        children: [
          ['forecasting', 'Demand forecasting', 2, 4, 'High'],
          ['replenishment', 'Replenishment', 3, 4, 'Medium'],
        ],
      },
      {
        id: 'logistics',
        name: 'Logistics',
        children: [
          ['warehousing', 'Warehousing', 4, 4, 'Medium'],
          ['delivery', 'Home delivery', 2, 3, 'Medium'],
        ],
      },
    ],
  },
  {
    id: 'support',
    name: 'Support',
    children: [
      {
        id: 'finance',
        name: 'Finance',
        children: [
          ['accounting', 'Accounting', 4, 4, 'Low'],
          ['planning', 'Financial planning', 2, 3, 'Medium'],
        ],
      },
      {
        id: 'people',
        name: 'People',
        children: [
          ['recruitment', 'Recruitment', 3, 3, 'Low'],
          ['payroll', 'Payroll', 4, 4, 'Low'],
        ],
      },
      {
        id: 'technology',
        name: 'Technology',
        children: [
          ['operations', 'IT operations', 3, 3, 'Medium'],
          ['data', 'Data management', 2, 4, 'Medium'],
        ],
      },
    ],
  },
];

const elements: SampleElement[] = [];
MAP.forEach((l1, i) => {
  const x = 40 + i * 404;
  const y = 40;
  elements.push({
    id: `l1_${l1.id}`,
    class: 'CapabilityL1',
    x,
    y,
    w: 384,
    h: 410,
    attributes: { Name: l1.name },
  });
  l1.children.forEach((l2, j) => {
    const y2 = y + 44 + j * 122;
    elements.push({
      id: `l2_${l2.id}`,
      class: 'CapabilityL2',
      x: x + 12,
      y: y2,
      w: 360,
      h: 110,
      parent: `l1_${l1.id}`,
      attributes: { Name: l2.name },
    });
    l2.children.forEach(([id, name, now, target, imp], k) =>
      elements.push({
        id: `l3_${id}`,
        class: 'CapabilityL3',
        x: x + 24 + k * 176,
        y: y2 + 38,
        parent: `l2_${l2.id}`,
        attributes: {
          Name: name,
          Maturity: now,
          TargetMaturity: target,
          StrategicImportance: imp,
        },
      }),
    );
  });
});

const APPS: [string, string, string, string, number][] = [
  ['shop', 'Online shop platform', 'Invest', 'Head of e-commerce', 4],
  ['till', 'Store till system', 'Tolerate', 'Head of stores', 2],
  ['desk', 'Customer service desk', 'Invest', 'Head of service', 4],
  ['merch', 'Merchandise planning tool', 'Migrate', 'Head of buying', 2],
  ['wms', 'Warehouse system', 'Tolerate', 'Head of logistics', 3],
  ['erp', 'Finance system', 'Eliminate', 'Finance director', 2],
  ['dataplatform', 'Data platform', 'Invest', 'Head of data', 4],
];
APPS.forEach(([id, name, lifecycle, owner, fit], i) =>
  elements.push({
    id: `app_${id}`,
    class: 'Application',
    x: 40 + i * 176,
    y: 520,
    attributes: {
      Name: name,
      Lifecycle: lifecycle,
      Owner: owner,
      TechnicalFit: fit,
    },
  }),
);

const supports = (
  app: string,
  capability: string,
  coverage: 'Full' | 'Partial' = 'Full',
): SampleConnector => ({
  relation: 'Supports',
  from: `app_${app}`,
  to: `l3_${capability}`,
  attributes: { Coverage: coverage },
});

export const capabilityMap: KitSpec = {
  folder: 'capability-map',
  id: 'kit_capabilitymap' as KitId,
  name: 'Business capability map',
  catalog: { keys: ['BusinessCapability', 'Application'] },
  amend: {
    BusinessCapability: {
      help: 'What the organisation is able to do, independent of how or by whom. Use one of its three levels.',
      abstract: true,
      look: null,
      remove: ['Level'],
      attributes: [
        scale('TargetMaturity', {
          help: 'The maturity the strategy needs, on the same scale.',
        }),
        choice('StrategicImportance', ['Low', 'Medium', 'High'], {
          help: 'How much the capability matters for the strategy.',
        }),
        text('Owner'),
        formula(
          'Gap',
          'Maturity == null || TargetMaturity == null ? null : max(0, TargetMaturity - Maturity)',
          'number',
          'Target maturity minus maturity, at least 0.',
        ),
        formula(
          'HeatScore',
          "Gap == null || StrategicImportance == null ? null : Gap * (StrategicImportance == 'High' ? 3 : (StrategicImportance == 'Medium' ? 2 : 1))",
          'number',
          'The gap times the importance (Low 1, Medium 2, High 3), from 0 to 12.',
        ),
        formula(
          'Heat',
          "HeatScore == null ? null : (HeatScore >= 6 ? 'Hot' : (HeatScore >= 3 ? 'Warm' : (HeatScore > 0 ? 'Mild' : 'Fine')))",
          'text',
          'Hot from a heat score of 6, Warm from 3, Mild above 0, otherwise Fine. The fill shows it.',
        ),
        formula(
          'Scores',
          "(Maturity == null ? '-' : text(Maturity)) + ' → ' + (TargetMaturity == null ? '-' : text(TargetMaturity)) + (StrategicImportance == null ? '' : ', ' + StrategicImportance)",
          'text',
          'Maturity, target and importance, such as "2 → 4, High".',
        ),
        formula(
          'Heading',
          "Name + (Maturity == null && TargetMaturity == null ? '' : ' (' + Scores + ')')",
          'text',
          'The name and the scores, shown as the heading of a container.',
        ),
        formula(
          'Applications',
          "count(incoming('Supports'))",
          'number',
          'How many applications support it.',
        ),
      ],
      constraints: [
        {
          id: 'k_capability_target',
          formula:
            'Maturity == null || TargetMaturity == null || TargetMaturity >= Maturity',
          message:
            "= 'The target maturity of \"' + Name + '\" is below its maturity.'",
        },
      ],
    },
    Application: {
      help: 'A software application, with its owner, what should happen to it and how well it fits technically.',
      attributes: [
        scale('TechnicalFit', {
          help: 'How well it fits the technology standards, from 1 (poor) to 5 (very good).',
        }),
        formula(
          'Capabilities',
          "count(outgoing('Supports'))",
          'number',
          'How many capabilities it supports.',
        ),
      ],
      look: look('box', {
        fill: {
          by: 'Lifecycle',
          values: {
            Invest: '#d3f9d8',
            Tolerate: '#fff3bf',
            Migrate: '#ffd8a8',
            Eliminate: '#ffc9c9',
          },
          fallback: '#e9ecef',
        },
        border: '#0c8599',
        subtitle: 'Lifecycle',
        width: 160,
      }),
      constraints: [
        {
          id: 'k_application_supports',
          formula: "count(outgoing('Supports')) > 0",
          message:
            '= \'Application "\' + Name + \'" supports no capability: connect it with "Supports".\'',
        },
      ],
    },
  },
  classes: [
    level(
      'CapabilityL1',
      'Level 1 capability',
      'A top-level area of the business, such as Customer or Finance. Place its level 2 capabilities inside it.',
      {
        kind: 'container',
        look: look('container', {
          fill: heat('55'),
          border: GREEN,
          borderWidth: 2,
          title: 'Heading',
          width: 384,
          height: 410,
        }),
      },
    ),
    level(
      'CapabilityL2',
      'Level 2 capability',
      'A part of a level 1 capability. Place its level 3 capabilities inside it.',
      {
        kind: 'container',
        look: look('container', {
          fill: heat('55'),
          border: GREEN,
          title: 'Heading',
          width: 360,
          height: 110,
        }),
        constraints: [insideConstraint('Level 2', 'level 1')],
      },
    ),
    level(
      'CapabilityL3',
      'Level 3 capability',
      'The most detailed level, scored on maturity, target and importance.',
      {
        look: look('rounded', {
          fill: heat(),
          border: GREEN,
          subtitle: 'Scores',
          width: 160,
          height: 60,
        }),
        constraints: [
          insideConstraint('Level 3', 'level 2'),
          {
            id: 'k_capability_applications',
            formula: "StrategicImportance != 'High' || Applications > 0",
            message:
              "= '\"' + Name + '\" is of high importance, but no application supports it.'",
          },
        ],
      },
    ),
  ],
  relations: [
    {
      key: 'Supports',
      label: 'Supports',
      help: 'The application helps the organisation perform the capability.',
      from: ['Application'],
      to: ['BusinessCapability'],
      attributes: [
        choice('Coverage', ['Full', 'Partial'], {
          help: 'Whether the application covers all of the capability or a part of it.',
        }),
      ],
      look: line('#0c8599', { style: 'dashed' }),
    },
  ],
  modelTypes: [
    {
      key: 'CapabilityMap',
      label: 'Capability map',
      help: 'Capabilities on three levels, scored and coloured by heat, and the applications that support them.',
      views: [
        {
          key: 'Map',
          label: 'Map',
          classes: ['CapabilityL1', 'CapabilityL2', 'CapabilityL3'],
          relations: [],
        },
        {
          key: 'Applications',
          label: 'Applications',
          classes: ['CapabilityL2', 'CapabilityL3', 'Application'],
          relations: ['Supports'],
        },
      ],
      containers: {
        CapabilityL1: ['CapabilityL2'],
        CapabilityL2: ['CapabilityL3'],
      },
      attributes: [
        text('Title', { required: true, maxLength: 100 }),
        text('Organisation'),
        formula(
          'AverageMaturity',
          "IFERROR(round(avg(objects('BusinessCapability').Maturity), 1), null)",
          'number',
          'The average maturity of all scored capabilities.',
        ),
        formula(
          'AverageTarget',
          "IFERROR(round(avg(objects('BusinessCapability').TargetMaturity), 1), null)",
          'number',
          'The average target maturity of all scored capabilities.',
        ),
      ],
    },
  ],
  panels: [panel('CapabilityL1'), panel('CapabilityL2'), panel('CapabilityL3')],
  sample: {
    file: 'retailer-capabilities.mkmodel.json',
    id: 'mdl_retailercapabilities',
    name: 'Capability map',
    modelType: 'CapabilityMap',
    attributes: {
      Title: 'Capability map 2027',
      Organisation: 'A regional retailer',
    },
    // "Dynamic pricing" is of high importance and no application supports it, on purpose.
    intendedWarnings: 1,
    elements,
    connectors: [
      supports('shop', 'online'),
      supports('shop', 'campaigns', 'Partial'),
      supports('till', 'store'),
      supports('till', 'returns', 'Partial'),
      supports('desk', 'support'),
      supports('desk', 'returns', 'Partial'),
      supports('merch', 'assortment'),
      supports('wms', 'warehousing'),
      supports('wms', 'replenishment', 'Partial'),
      supports('erp', 'accounting'),
      supports('erp', 'planning', 'Partial'),
      supports('erp', 'payroll'),
      supports('dataplatform', 'insight'),
      supports('dataplatform', 'forecasting', 'Partial'),
      supports('dataplatform', 'data'),
    ],
  },
};
