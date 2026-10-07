import type { ToolLibrary } from '../meta/types';
import { MODEL_FORMAT_VERSION, type Model } from '../model/types';
import { TOOL_FORMAT_VERSION } from '../meta/types';

/** Readable fixed ids, so tests can name things. Real libraries use random ids. */
export const SAMPLE = {
  tool: 'tool_sample',
  flowNode: 'cls_flownode',
  task: 'cls_task',
  gateway: 'cls_gateway',
  start: 'cls_start',
  end: 'cls_end',
  lane: 'cls_lane',
  flow: 'rel_flow',
  process: 'mt_process',
  attName: 'att_name',
  attPriority: 'att_priority',
  attEffort: 'att_effort',
  attCost: 'att_cost',
  attKind: 'att_kind',
  attCondition: 'att_condition',
  attTitle: 'att_title',
  attVersion: 'att_version',
  attCode: 'att_code',
} as const;

/** A small BPMN-like tool library covering inheritance, an abstract class, a relation and cardinalities. */
export function sampleTool(): ToolLibrary {
  return {
    formatVersion: TOOL_FORMAT_VERSION,
    manifest: {
      id: SAMPLE.tool,
      name: 'Sample',
      version: '1.0.0',
      languages: ['en', 'de'],
    },
    settings: {
      grid: { size: 10, snap: true, visible: true },
      layers: [{ key: 'main', labels: { en: 'Main' }, visible: true }],
      numbering: { enabled: false, prefix: '', start: 1 },
    },
    classes: {
      [SAMPLE.flowNode]: {
        id: SAMPLE.flowNode,
        key: 'FlowNode',
        kind: 'node',
        labels: { en: 'Flow node', de: 'Flussknoten' },
        abstract: true,
        attributes: [
          {
            id: SAMPLE.attName,
            key: 'Name',
            type: 'text',
            required: true,
            maxLength: 20,
            default: 'New',
          },
          {
            id: SAMPLE.attCode,
            key: 'Code',
            type: 'text',
            pattern: '^[A-Z]{3}-\\d+$',
          },
        ],
      },
      [SAMPLE.task]: {
        id: SAMPLE.task,
        key: 'Task',
        kind: 'node',
        labels: { en: 'Task', de: 'Aufgabe' },
        extends: SAMPLE.flowNode,
        attributes: [
          {
            id: SAMPLE.attPriority,
            key: 'Priority',
            type: 'choice',
            options: ['Low', 'Medium', 'High'],
            default: 'Medium',
          },
          {
            id: SAMPLE.attEffort,
            key: 'Effort',
            type: 'number',
            min: 0,
            decimals: 1,
            unit: 'h',
          },
          {
            id: SAMPLE.attCost,
            key: 'Cost',
            type: 'formula',
            formula: 'Effort * 85',
          },
        ],
      },
      [SAMPLE.gateway]: {
        id: SAMPLE.gateway,
        key: 'Gateway',
        kind: 'node',
        labels: { en: 'Gateway' },
        extends: SAMPLE.flowNode,
        attributes: [
          {
            id: SAMPLE.attKind,
            key: 'GatewayKind',
            type: 'choice',
            options: ['XOR', 'AND'],
            default: 'XOR',
          },
        ],
      },
      [SAMPLE.start]: {
        id: SAMPLE.start,
        key: 'StartEvent',
        kind: 'node',
        labels: { en: 'Start event' },
        extends: SAMPLE.flowNode,
        attributes: [],
      },
      [SAMPLE.end]: {
        id: SAMPLE.end,
        key: 'EndEvent',
        kind: 'node',
        labels: { en: 'End event' },
        extends: SAMPLE.flowNode,
        attributes: [],
      },
      [SAMPLE.lane]: {
        id: SAMPLE.lane,
        key: 'Lane',
        kind: 'swimlane',
        labels: { en: 'Lane' },
        attributes: [
          { id: 'att_lanename', key: 'LaneName', type: 'text', required: true },
        ],
      },
    },
    relations: {
      [SAMPLE.flow]: {
        id: SAMPLE.flow,
        key: 'SequenceFlow',
        labels: { en: 'Sequence flow' },
        from: [SAMPLE.flowNode],
        to: [SAMPLE.flowNode],
        attributes: [
          { id: SAMPLE.attCondition, key: 'Condition', type: 'text' },
        ],
      },
    },
    modelTypes: {
      [SAMPLE.process]: {
        id: SAMPLE.process,
        key: 'Process',
        labels: { en: 'Process' },
        classes: [
          SAMPLE.task,
          SAMPLE.gateway,
          SAMPLE.start,
          SAMPLE.end,
          SAMPLE.lane,
        ],
        relations: [SAMPLE.flow],
        views: [
          {
            id: 'vw_flow',
            key: 'FlowOnly',
            labels: { en: 'Flow only' },
            classes: [SAMPLE.task, SAMPLE.gateway, SAMPLE.start, SAMPLE.end],
            relations: [SAMPLE.flow],
          },
        ],
        cardinalities: [
          { kind: 'count', class: SAMPLE.start, min: 1, max: 1 },
          { kind: 'count', class: SAMPLE.end, min: 1 },
          {
            kind: 'degree',
            class: SAMPLE.start,
            relation: SAMPLE.flow,
            end: 'to',
            max: 0,
          },
        ],
        attributes: [
          { id: SAMPLE.attTitle, key: 'Title', type: 'text', required: true },
          { id: SAMPLE.attVersion, key: 'Version', type: 'integer', min: 1 },
        ],
      },
    },
    shapes: {},
    panels: {},
    rules: {},
  } as unknown as ToolLibrary;
}

export function emptySampleModel(): Model {
  return {
    formatVersion: MODEL_FORMAT_VERSION,
    manifest: {
      id: 'mdl_sample',
      name: 'Order process',
      tool: SAMPLE.tool,
      toolVersion: '1.0.0',
      modelType: SAMPLE.process,
    },
    attrs: {},
    elements: {},
    connectors: {},
  } as unknown as Model;
}

/** A deep copy through JSON, for tests; `packages/core` has no DOM or Node types, so no `structuredClone`. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The sample tool, an empty model of it and the ids the tests need, for packages that test behaviour. */
export function SAMPLE_FOR_TESTS() {
  return {
    tool: sampleTool(),
    model: emptySampleModel(),
    ids: {
      task: SAMPLE.task,
      effort: SAMPLE.attEffort,
      name: SAMPLE.attName,
      priority: SAMPLE.attPriority,
    },
  };
}
