import type { ToolId } from '@metakit-app/core';

/**
 * The tool libraries that ship with MetaKit (ADR 0010). They are read-only: a workspace either
 * uses one unchanged or makes a copy to extend. Each file loads only when it is needed, so the
 * list costs nothing at start-up. The name, version and id are repeated here so the page can show
 * them without loading the files; a test keeps them equal to the files.
 */
export interface BuiltInTool {
  id: ToolId;
  name: string;
  version: string;
  /** One line about what it is for. */
  description: string;
  /** The text of its tool.json. */
  load: () => Promise<string>;
}

/** Where a new tool library starts: empty, or a copy of a workspace or built-in library. */
export type ToolStart =
  | { kind: 'empty' }
  | { kind: 'workspace'; slug: string }
  | { kind: 'built-in'; tool: BuiltInTool };

export const BUILT_IN_TOOLS: readonly BuiltInTool[] = [
  {
    id: 'tool_bpmnlite' as ToolId,
    name: 'BPMN lite',
    version: '1.0.0',
    description:
      'Business processes: tasks, events, gateways and lanes connected by sequence flows.',
    load: () =>
      import('../../../../tools/bpmn-lite/tool.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_erlite' as ToolId,
    name: 'ER lite',
    version: '1.0.0',
    description:
      'Data models: entities, their attributes and the relationships between them.',
    load: () =>
      import('../../../../tools/er-lite/tool.json?raw').then((m) => m.default),
  },
  {
    id: 'tool_agentpipeline' as ToolId,
    name: 'Agent pipeline',
    version: '1.0.0',
    description:
      'Pipelines in which AI agents and people perform tasks, hand over work and approve results.',
    load: () =>
      import('../../../../tools/agent-pipeline/tool.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_dataaiarch' as ToolId,
    name: 'Data and AI architecture',
    version: '1.0.0',
    description:
      'Data platforms: sources, pipelines, stores, datasets, ML models, AI services and consumers, with data lineage and personal-data checks.',
    load: () =>
      import('../../../../tools/data-ai-architecture/tool.json?raw').then(
        (m) => m.default,
      ),
  },
  {
    id: 'tool_aiportfolio' as ToolId,
    name: 'AI use-case portfolio',
    version: '1.0.0',
    description:
      'AI use cases scored on value, feasibility, data readiness and risk, with a priority score, quadrants and a ranking.',
    load: () =>
      import('../../../../tools/ai-use-case-portfolio/tool.json?raw').then(
        (m) => m.default,
      ),
  },
];
