import type { KitId } from '@metakit-app/core';

/**
 * The Kits that ship with MetaKit (ADR 0010). They are read-only: a workspace either
 * uses one unchanged or makes a copy to extend. Each file loads only when it is needed, so the
 * list costs nothing at start-up. The name, version and id are repeated here so the page can show
 * them without loading the files; a test keeps them equal to the files.
 */
export interface BuiltInKit {
  id: KitId;
  name: string;
  version: string;
  /** One line about what it is for. */
  description: string;
  /** The heading it is listed under. */
  domain: BuiltInDomain;
  /** The text of its kit.json. */
  load: () => Promise<string>;
}

export type BuiltInDomain =
  'data-ai' | 'business' | 'delivery' | 'architecture' | 'general';

/** The headings of the built-in Kits, in the order the Kits page and the dialogs list them. */
export const BUILT_IN_DOMAINS: readonly { id: BuiltInDomain; label: string }[] =
  [
    { id: 'data-ai', label: 'Data and AI' },
    { id: 'business', label: 'Business and strategy' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'general', label: 'General' },
  ];

/** Where a new Kit starts: empty, or a copy of a workspace or built-in library. */
export type KitStart =
  | { kind: 'empty' }
  | { kind: 'workspace'; slug: string }
  | { kind: 'built-in'; kit: BuiltInKit };

/**
 * In the order of `BUILT_IN_DOMAINS`, so every list of them (the Kits page, Start from in New
 * Kit and the built-in group of New model) shows them in the same order.
 */
export const BUILT_IN_KITS: readonly BuiltInKit[] = [
  {
    id: 'kit_dataaistrategy' as KitId,
    name: 'Data and AI strategy',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'A vision, goals and objectives, value drivers, AI use cases and data and AI capabilities, with initiatives on a roadmap and the value of their benefits.',
    load: () =>
      import('../../../../kits/data-ai-strategy/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_dataaimaturity' as KitId,
    name: 'Data and AI maturity assessment',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Capabilities in dimensions such as governance, data quality and AI, scored now and as a target, with the gap, a priority and the actions that close it.',
    load: () =>
      import('../../../../kits/data-ai-maturity/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_aiportfolio' as KitId,
    name: 'AI use-case portfolio',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'AI use cases scored on value, feasibility, data readiness and risk, with a priority score, quadrants and a ranking.',
    load: () =>
      import('../../../../kits/ai-use-case-portfolio/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_kpitree' as KitId,
    name: 'KPI and metric tree',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Outcome KPIs explained by driver and operational metrics, each with a target, a current value and a direction, coloured by whether it is on track.',
    load: () =>
      import('../../../../kits/kpi-metric-tree/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_dataaiarch' as KitId,
    name: 'Data and AI architecture',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Data platforms: sources, pipelines, stores, datasets, ML models, AI services and consumers, with data lineage and personal-data checks.',
    load: () =>
      import('../../../../kits/data-ai-architecture/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_datagov' as KitId,
    name: 'Data governance and ownership',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Data ownership and governance: domains, data products, assets, owners and stewards, policies, classifications and quality rules.',
    load: () =>
      import('../../../../kits/data-governance/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_agentpipeline' as KitId,
    name: 'Agent pipeline',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Pipelines in which AI agents and people perform tasks, hand over work and approve results.',
    load: () =>
      import('../../../../kits/agent-pipeline/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_bpmnlite' as KitId,
    name: 'BPMN lite',
    version: '1.0.0',
    domain: 'business',
    description:
      'Business processes: tasks, events, gateways and lanes connected by sequence flows.',
    load: () =>
      import('../../../../kits/bpmn-lite/kit.json?raw').then((m) => m.default),
  },
  {
    id: 'kit_projectraid' as KitId,
    name: 'Project delivery and RAID',
    version: '1.0.0',
    domain: 'delivery',
    description:
      'A programme in workstreams with tasks, deliverables and milestones, and a RAID log of risks, assumptions, issues, dependencies and decisions, with progress and overdue dates.',
    load: () =>
      import('../../../../kits/project-raid/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_requirements' as KitId,
    name: 'Requirements and user stories',
    version: '1.0.0',
    domain: 'delivery',
    description:
      'Epics, features and user stories with acceptance criteria, MoSCoW priorities and story points, traced to goals, requirements and tests.',
    load: () =>
      import('../../../../kits/requirements-stories/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_decisiontables' as KitId,
    name: 'Decision tables (DMN-style)',
    version: '1.0.0',
    domain: 'delivery',
    description:
      'Decisions with their logic as a table of rules and a hit policy, the input data and decisions they need, business knowledge models and knowledge sources.',
    load: () =>
      import('../../../../kits/decision-tables/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_erlite' as KitId,
    name: 'ER lite',
    version: '1.0.0',
    domain: 'architecture',
    description:
      'Data models: entities, their attributes and the relationships between them.',
    load: () =>
      import('../../../../kits/er-lite/kit.json?raw').then((m) => m.default),
  },
  {
    id: 'kit_enterprisearch' as KitId,
    name: 'Enterprise architecture',
    version: '1.0.0',
    domain: 'architecture',
    description:
      'Business, application and technology layers: actors, roles, processes and services, application components, interfaces and data objects, nodes, system software and networks, and how they serve, realise and run each other.',
    load: () =>
      import('../../../../kits/enterprise-architecture/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_c4' as KitId,
    name: 'Software architecture (C4-style)',
    version: '1.0.0',
    domain: 'architecture',
    description:
      'Software at three levels in the C4 style: people and software systems, the containers inside a system and the components inside a container, with what each relationship is for and how it talks.',
    load: () =>
      import('../../../../kits/software-c4/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_eventstorming' as KitId,
    name: 'Event storming',
    version: '1.0.0',
    domain: 'architecture',
    description:
      'Domain events on a timeline with the commands, actors, aggregates, policies, read models and external systems around them, hotspots for open questions and bounded contexts as lanes.',
    load: () =>
      import('../../../../kits/event-storming/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_threatmodel' as KitId,
    name: 'Security threat model',
    version: '1.0.0',
    domain: 'architecture',
    description:
      'A data flow diagram inside trust boundaries, with the assets worth protecting, threats sorted by STRIDE category and scored by likelihood and impact, and their mitigations.',
    load: () =>
      import('../../../../kits/threat-model/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_mindmap' as KitId,
    name: 'Mind map and concept map',
    version: '1.0.0',
    domain: 'general',
    description:
      'Mind maps that grow from a central topic into topics and ideas coloured by branch, and concept maps of concepts joined by labelled links.',
    load: () =>
      import('../../../../kits/mind-map/kit.json?raw').then((m) => m.default),
  },
  {
    id: 'kit_orgchart' as KitId,
    name: 'Org chart',
    version: '1.0.0',
    domain: 'general',
    description:
      'Organisation units, positions and the people who fill them, with reporting lines, head count and vacancies.',
    load: () =>
      import('../../../../kits/org-chart/kit.json?raw').then((m) => m.default),
  },
];

/** The built-in Kits whose name or description holds every word of the query, in any case. */
export function searchBuiltIns(
  kits: readonly BuiltInKit[],
  query: string,
): BuiltInKit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return kits.filter((k) => {
    const hay = `${k.name} ${k.description}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** The Kits under each heading, headings without a Kit left out. */
export function groupBuiltIns(
  kits: readonly BuiltInKit[],
): { id: BuiltInDomain; label: string; kits: BuiltInKit[] }[] {
  return BUILT_IN_DOMAINS.map((d) => ({
    ...d,
    kits: kits.filter((k) => k.domain === d.id),
  })).filter((g) => g.kits.length > 0);
}
