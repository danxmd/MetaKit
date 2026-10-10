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
  /** The text of its kit.json. */
  load: () => Promise<string>;
}

/** Where a new Kit starts: empty, or a copy of a workspace or built-in library. */
export type KitStart =
  | { kind: 'empty' }
  | { kind: 'workspace'; slug: string }
  | { kind: 'built-in'; kit: BuiltInKit };

export const BUILT_IN_KITS: readonly BuiltInKit[] = [
  {
    id: 'tool_bpmnlite' as KitId,
    name: 'BPMN lite',
    version: '1.0.0',
    description:
      'Business processes: tasks, events, gateways and lanes connected by sequence flows.',
    load: () =>
      import('../../../../kits/bpmn-lite/kit.json?raw').then((m) => m.default),
  },
  {
    id: 'tool_erlite' as KitId,
    name: 'ER lite',
    version: '1.0.0',
    description:
      'Data models: entities, their attributes and the relationships between them.',
    load: () =>
      import('../../../../kits/er-lite/kit.json?raw').then((m) => m.default),
  },
  {
    id: 'tool_agentpipeline' as KitId,
    name: 'Agent pipeline',
    version: '1.0.0',
    description:
      'Pipelines in which AI agents and people perform tasks, hand over work and approve results.',
    load: () =>
      import('../../../../kits/agent-pipeline/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_dataaiarch' as KitId,
    name: 'Data and AI architecture',
    version: '1.0.0',
    description:
      'Data platforms: sources, pipelines, stores, datasets, ML models, AI services and consumers, with data lineage and personal-data checks.',
    load: () =>
      import('../../../../kits/data-ai-architecture/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_aiportfolio' as KitId,
    name: 'AI use-case portfolio',
    version: '1.0.0',
    description:
      'AI use cases scored on value, feasibility, data readiness and risk, with a priority score, quadrants and a ranking.',
    load: () =>
      import('../../../../kits/ai-use-case-portfolio/kit.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_datagov' as KitId,
    name: 'Data governance and ownership',
    version: '1.0.0',
    description:
      'Data ownership and governance: domains, data products, assets, owners and stewards, policies, classifications and quality rules.',
    load: () =>
      import('../../../../kits/data-governance/kit.json?raw').then(
        (m) => m.default,
      ),
  },
];
