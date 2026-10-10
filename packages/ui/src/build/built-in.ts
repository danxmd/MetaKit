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
    id: 'kit_mllifecycle' as KitId,
    name: 'ML lifecycle (MLOps)',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Datasets and features, experiments and training runs, model versions in a registry with evaluations and approvals, deployments per environment, monitors and incidents.',
    load: () =>
      import('../../../../kits/ml-lifecycle/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_genaisolution' as KitId,
    name: 'Generative AI solution',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Use cases, flows, prompts and foundation models, a retrieval pipeline, agents and tools, guardrails, evaluations and human review, with the cost and latency of each request.',
    load: () =>
      import('../../../../kits/genai-solution/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_airiskcompliance' as KitId,
    name: 'AI risk and compliance',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'AI systems with their intended purpose and a risk tier, risks and controls, obligations, assessments, incidents, owners and evidence.',
    load: () =>
      import('../../../../kits/ai-risk-compliance/kit.json?raw').then(
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
    id: 'kit_capabilitymap' as KitId,
    name: 'Business capability map',
    version: '1.0.0',
    domain: 'business',
    description:
      'Capabilities on three levels with maturity, target and strategic importance, a heat colour, and the applications that support them.',
    load: () =>
      import('../../../../kits/capability-map/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_bmcanvas' as KitId,
    name: 'Business model canvas',
    version: '1.0.0',
    domain: 'business',
    description:
      'The nine blocks of a business model as containers, with items, how well each is tested, annual amounts and links between items.',
    load: () =>
      import('../../../../kits/business-model-canvas/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_valuejourneys' as KitId,
    name: 'Value streams and customer journeys',
    version: '1.0.0',
    domain: 'business',
    description:
      'Value streams and customer journeys: stages, touchpoints scored by emotion, channels, pain points, opportunities and metrics.',
    load: () =>
      import('../../../../kits/value-streams-journeys/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_stakeholdermap' as KitId,
    name: 'Stakeholder and organisation map',
    version: '1.0.0',
    domain: 'business',
    description:
      'Organisation units, roles and people, stakeholders on an interest and influence grid with their attitude, and RACI for activities and deliverables.',
    load: () =>
      import('../../../../kits/stakeholder-org-map/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_okrs' as KitId,
    name: 'OKRs and goals',
    version: '1.0.0',
    domain: 'business',
    description:
      'Goals, objectives and key results per period, with progress from start, target and current values, initiatives and owners.',
    load: () =>
      import('../../../../kits/okrs-goals/kit.json?raw').then((m) => m.default),
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
