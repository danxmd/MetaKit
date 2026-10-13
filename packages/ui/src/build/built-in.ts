// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- the d.ts must travel with this file into packages that import it
/// <reference path="./vite-glob.d.ts" />

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
  /** Its folder in the repository's `kits/`, which also holds its sample models. */
  folder: string;
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
    folder: 'data-ai-strategy',
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
    folder: 'data-ai-maturity',
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
    folder: 'ai-use-case-portfolio',
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
    folder: 'kpi-metric-tree',
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
    folder: 'data-ai-architecture',
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
    folder: 'data-governance',
    load: () =>
      import('../../../../kits/data-governance/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_datamesh' as KitId,
    name: 'Data mesh and data products',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Domains that own data products, with input and output ports, data contracts with a schema, a service level and a version, consumers, the self-serve platform and governance policies.',
    folder: 'data-mesh',
    load: () =>
      import('../../../../kits/data-mesh/kit.json?raw').then((m) => m.default),
  },
  {
    id: 'kit_datamodelling' as KitId,
    name: 'Data modelling',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Conceptual, logical and physical data models: subject areas, entities with attributes and keys, relationships with cardinality, and tables with typed columns and foreign keys.',
    folder: 'data-modelling',
    load: () =>
      import('../../../../kits/data-modelling/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_datalineage' as KitId,
    name: 'Data pipelines and lineage',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Sources, jobs, schedules, datasets, reports and target applications, with lineage down to the field, upstream and downstream counts and checks for unscheduled jobs and orphan datasets.',
    folder: 'data-pipelines-lineage',
    load: () =>
      import('../../../../kits/data-pipelines-lineage/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_dataquality' as KitId,
    name: 'Data quality management',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Quality rules with thresholds and results on data assets, quality dimensions, issues with severity, status and owner, and the actions that resolve them, with pass rates and quality scores.',
    folder: 'data-quality',
    load: () =>
      import('../../../../kits/data-quality/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_masterdata' as KitId,
    name: 'Master data management',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Master data domains with golden records, the source systems that supply them, match and survivorship rules, MDM hubs in the registry, consolidation, coexistence or centralised style, and data stewards.',
    folder: 'master-data',
    load: () =>
      import('../../../../kits/master-data/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_analyticsbi' as KitId,
    name: 'Analytics and BI landscape',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Reports and dashboards with their owners, usage and refresh, the semantic models and metrics they are built on and the audiences they serve, with checks for metrics defined twice.',
    folder: 'analytics-bi',
    load: () =>
      import('../../../../kits/analytics-bi/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_privacyropa' as KitId,
    name: 'Privacy and records of processing',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Records of processing: activities with purposes and legal bases, data categories, data subjects, recipients and transfers with safeguards, retention, systems and an impact assessment indication.',
    folder: 'privacy-ropa',
    load: () =>
      import('../../../../kits/privacy-ropa/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'kit_clouddatamigration' as KitId,
    name: 'Cloud data migration',
    version: '1.0.0',
    domain: 'data-ai',
    description:
      'Workloads moving from source systems to cloud target services in migration waves, with dependencies, cut-over plans, status, risks and the readiness of each wave.',
    folder: 'cloud-data-migration',
    load: () =>
      import('../../../../kits/cloud-data-migration/kit.json?raw').then(
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
    folder: 'agent-pipeline',
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
    folder: 'ml-lifecycle',
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
    folder: 'genai-solution',
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
    folder: 'ai-risk-compliance',
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
    folder: 'bpmn-lite',
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
    folder: 'capability-map',
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
    folder: 'business-model-canvas',
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
    folder: 'value-streams-journeys',
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
    folder: 'stakeholder-org-map',
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
    folder: 'okrs-goals',
    load: () =>
      import('../../../../kits/okrs-goals/kit.json?raw').then((m) => m.default),
  },
  {
    id: 'kit_projectraid' as KitId,
    name: 'Project delivery and RAID',
    version: '1.0.0',
    domain: 'delivery',
    description:
      'A programme in workstreams with tasks, deliverables and milestones, and a RAID log of risks, assumptions, issues, dependencies and decisions, with progress and overdue dates.',
    folder: 'project-raid',
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
    folder: 'requirements-stories',
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
    folder: 'decision-tables',
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
    folder: 'er-lite',
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
    folder: 'enterprise-architecture',
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
    folder: 'software-c4',
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
    folder: 'event-storming',
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
    folder: 'threat-model',
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
    folder: 'mind-map',
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
    folder: 'org-chart',
    load: () =>
      import('../../../../kits/org-chart/kit.json?raw').then((m) => m.default),
  },
];

/** A sample model of a built-in Kit: the text of its editable model file. */
export interface BuiltInSample {
  /** The file name without `.mkmodel.json`, which orders the samples of a Kit. */
  name: string;
  text: string;
}

// One lazy chunk per sample, so nothing loads until a Kit is previewed.
const SAMPLE_FILES = import.meta.glob('../../../../kits/*/*.mkmodel.json', {
  query: '?raw',
  import: 'default',
});

/** The sample models of a built-in Kit, sorted by file name. */
export async function builtInSamples(
  kit: Pick<BuiltInKit, 'folder'>,
): Promise<BuiltInSample[]> {
  const prefix = `../../../../kits/${kit.folder}/`;
  const paths = Object.keys(SAMPLE_FILES)
    .filter(
      (p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'),
    )
    .sort();
  return Promise.all(
    paths.map(async (p) => ({
      name: p.slice(prefix.length, -'.mkmodel.json'.length),
      text: await SAMPLE_FILES[p]!(),
    })),
  );
}

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
